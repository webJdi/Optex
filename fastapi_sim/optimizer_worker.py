"""
Optimizer Worker - Runs independently from the main FastAPI server
Polls Firebase for optimization requests and executes them in the background
"""

import time
import asyncio
import firebase_admin
from firebase_admin import credentials, firestore
import os
import sys

# Import the optimization logic from main.py
# We'll need to refactor main.py to make the optimization function importable

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not firebase_admin._apps:
            service_key_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
            
            if os.path.exists(service_key_path):
                cred = credentials.Certificate(service_key_path)
                firebase_admin.initialize_app(cred)
                print(f"✓ Firebase initialized with service account key: {service_key_path}")
            else:
                firebase_admin.initialize_app(options={
                    'projectId': 'optex-b13d3',
                })
                print("✓ Firebase initialized with default credentials")
        
        db = firestore.client()
        print("✓ Firestore client ready")
        return db
    except Exception as e:
        print(f"⚠ Firebase initialization failed: {e}")
        return None

def save_optimization_to_firebase(result, segment):
    """Save optimization results to Firebase optimized_targets collection"""
    try:
        db = firestore.client()
        
        # Convert optimization_history to a simple list if it exists
        opt_history = result.get('optimization_history', [])
        if opt_history and isinstance(opt_history, list):
            # Ensure it's a list of simple dicts with serializable values
            opt_history = [
                {
                    'trial': item.get('trial', idx + 1),
                    'economic_value': float(item.get('economic_value', 0)),
                    'constraint_penalty': float(item.get('constraint_penalty', 0)),
                    'objective_score': float(item.get('objective_score', 0)),
                    'optimization_vars': item.get('optimization_vars', {}),  # Include optimization variables
                    'constraint_vars': item.get('constraint_vars', {})  # Include constraint variables
                }
                for idx, item in enumerate(opt_history)
            ]
        else:
            opt_history = []
        
        # Debug: Verify what we're about to save
        if opt_history:
            print(f"🔍 Debug: Saving {len(opt_history)} history items to Firebase")
            print(f"🔍 Debug: First item to be saved keys: {opt_history[0].keys()}")
            print(f"🔍 Debug: First item to be saved: {opt_history[0]}")
        
        optimization_record = {
            'timestamp': firestore.SERVER_TIMESTAMP,
            'segment': segment,
            'apc_targets': result.get('apc_optimization', {}).get('suggested_targets', {}),
            'apc_economic_value': result.get('apc_optimization', {}).get('economic_value', 0),
            'apc_optimization_score': result.get('apc_optimization', {}).get('optimization_score', 0),
            'engineering_targets': result.get('engineering_optimization', {}).get('suggested_targets', {}),
            'engineering_economic_value': result.get('engineering_optimization', {}).get('economic_value', 0),
            'engineering_optimization_score': result.get('engineering_optimization', {}).get('optimization_score', 0),
            'economic_benefit': (result.get('engineering_optimization', {}).get('economic_value', 0) -
                                result.get('apc_optimization', {}).get('economic_value', 0)),
            'pricing_details': result.get('pricing_details', {}),
            'optimization_history': opt_history  # Save the cleaned convergence plot data
        }
        
        db.collection('optimized_targets').add(optimization_record)
        print(f"💾 Optimization results saved to Firebase (history: {len(opt_history)} trials)")
    except Exception as e:
        print(f"⚠ Error saving to Firebase: {e}")
        import traceback
        traceback.print_exc()

def run_optimization(segment: str):
    """
    Run the optimization by calling the INTERNAL POST endpoint
    This endpoint actually executes the optimization logic
    """
    import requests
    
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    try:
        # Call the POST endpoint with JSON payload
        payload = {
            "segment": segment,
            "n_data": 50,
            "use_custom_pricing": False
            # Don't include constraint_ranges or custom_pricing if they're None/null
        }
        
        print(f"📡 Calling optimization API: POST {backend_url}/optimize_targets")
        response = requests.post(
            f'{backend_url}/optimize_targets',
            json=payload,
            timeout=600  # 10 minute timeout for optimization
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Optimization completed for {segment}")
            
            # Debug: Check what we received
            print(f"🔍 Debug: Result keys: {result.keys()}")
            print(f"🔍 Debug: optimization_history type: {type(result.get('optimization_history'))}")
            print(f"🔍 Debug: optimization_history length: {len(result.get('optimization_history', []))}")
            if result.get('optimization_history'):
                first_item = result['optimization_history'][0]
                print(f"🔍 Debug: First history item keys: {first_item.keys()}")
                print(f"🔍 Debug: First history item: {first_item}")
                if 'optimization_vars' in first_item:
                    print(f"🔍 Debug: optimization_vars in first item: {first_item['optimization_vars']}")
                if 'constraint_vars' in first_item:
                    print(f"🔍 Debug: constraint_vars in first item: {first_item['constraint_vars']}")
            
            # Save results to Firebase
            save_optimization_to_firebase(result, segment)
            
            return result
        else:
            print(f"✗ Optimization failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"✗ Error running optimization: {e}")
        import traceback
        traceback.print_exc()
        return None

async def check_and_run_optimization_worker(db):
    """
    Check Firebase for optimization state and run if needed
    This is similar to the /check_and_run_optimization endpoint but runs independently
    """
    try:
        # Get current optimizer state
        state_ref = db.collection('optimizer_state').document('current')
        state_doc = state_ref.get()
        
        if not state_doc.exists:
            print("No optimizer state found")
            return
        
        state = state_doc.to_dict()
        
        if not state.get('running') or not state.get('autoSchedule'):
            print(f"Optimizer not running (running={state.get('running')}, autoSchedule={state.get('autoSchedule')})")
            return
        
        # Calculate elapsed time since last update
        last_update = state.get('lastUpdateTime')
        if last_update:
            current_time = time.time() * 1000  # Convert to milliseconds
            elapsed = (current_time - last_update) / 1000  # Convert to seconds
            timer = state.get('timer', 300)
            
            print(f"Time since last update: {elapsed:.0f}s / {timer}s")
            
            # Check if 5 minutes (300 seconds) have passed
            if elapsed >= timer:
                segment = state.get('segment', 'Clinkerization')
                print(f"⏰ Timer expired! Running optimization for {segment}...")
                
                # Run optimization (synchronous)
                result = run_optimization(segment)
                
                if result:
                    # Reset timer
                    state_ref.update({
                        'timer': 300,
                        'lastUpdateTime': int(time.time() * 1000)
                    })
                    print(f"✓ Optimization completed and timer reset")
                else:
                    print(f"✗ Optimization failed")
            else:
                remaining = timer - elapsed
                print(f"⏳ Waiting... {remaining:.0f}s remaining")
        else:
            print("No lastUpdateTime found in state")
    
    except Exception as e:
        print(f"✗ Error in optimization worker: {e}")
        import traceback
        traceback.print_exc()

async def main_loop():
    """Main worker loop - polls every 10 seconds"""
    print("=" * 60)
    print("🚀 Optimizer Worker Started")
    print("=" * 60)
    
    db = initialize_firebase()
    
    if not db:
        print("❌ Failed to initialize Firebase. Exiting...")
        return
    
    print("\n👀 Watching for optimization requests...")
    print("Polling interval: 10 seconds")
    print("Press Ctrl+C to stop\n")
    
    while True:
        try:
            await check_and_run_optimization_worker(db)
            await asyncio.sleep(10)  # Check every 10 seconds
        except KeyboardInterrupt:
            print("\n\n🛑 Stopping optimizer worker...")
            break
        except Exception as e:
            print(f"❌ Unexpected error in main loop: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(10)  # Wait before retrying

if __name__ == "__main__":
    # Run the worker
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\n✓ Optimizer worker stopped")
