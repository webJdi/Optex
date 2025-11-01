"""
Test script for dual optimization endpoint
Tests both APC limits and engineering limits optimization
"""
import requests
import json
from datetime import datetime

# Backend URL - update if different
BACKEND_URL = "http://localhost:8000"

def test_optimize_targets():
    """Test the /optimize_targets endpoint with dual optimization"""
    print("=" * 60)
    print("Testing Dual Optimization Endpoint")
    print("=" * 60)
    
    # Test payload
    payload = {
        "segment": "Clinkerization",
        "n_data": 50
    }
    
    try:
        print(f"\n📤 Sending POST request to {BACKEND_URL}/optimize_targets")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{BACKEND_URL}/optimize_targets",
            json=payload,
            timeout=120  # 2 minute timeout for optimization
        )
        
        print(f"\n✓ Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "=" * 60)
            print("OPTIMIZATION RESULTS")
            print("=" * 60)
            
            # Check if we have both optimizations
            if "apc_optimization" in result and "engineering_optimization" in result:
                print("\n✅ Dual optimization successful!")
                
                # APC Optimization Results
                print("\n📊 APC-CONSTRAINED OPTIMIZATION:")
                print("-" * 60)
                apc_opt = result["apc_optimization"]
                if apc_opt.get("success"):
                    print(f"  Economic Value: ${apc_opt.get('economic_value', 0):.2f}/hour")
                    print(f"  Optimization Score: {apc_opt.get('optimization_score', 0):.4f}")
                    print(f"\n  Suggested Targets:")
                    for var, value in apc_opt.get("suggested_targets", {}).items():
                        print(f"    {var}: {value:.2f}")
                else:
                    print(f"  ❌ Failed: {apc_opt.get('error', 'Unknown error')}")
                
                # Engineering Optimization Results
                print("\n📊 ENGINEERING-CONSTRAINED OPTIMIZATION:")
                print("-" * 60)
                eng_opt = result["engineering_optimization"]
                if eng_opt.get("success"):
                    print(f"  Economic Value: ${eng_opt.get('economic_value', 0):.2f}/hour")
                    print(f"  Optimization Score: {eng_opt.get('optimization_score', 0):.4f}")
                    print(f"\n  Suggested Targets:")
                    for var, value in eng_opt.get("suggested_targets", {}).items():
                        print(f"    {var}: {value:.2f}")
                else:
                    print(f"  ❌ Failed: {eng_opt.get('error', 'Unknown error')}")
                
                # Comparison
                if apc_opt.get("success") and eng_opt.get("success"):
                    apc_value = apc_opt.get("economic_value", 0)
                    eng_value = eng_opt.get("economic_value", 0)
                    diff = eng_value - apc_value
                    print("\n💰 ECONOMIC COMPARISON:")
                    print("-" * 60)
                    print(f"  APC Limits:         ${apc_value:.2f}/hour")
                    print(f"  Engineering Limits: ${eng_value:.2f}/hour")
                    print(f"  Potential Gain:     ${diff:.2f}/hour ({diff/apc_value*100:.1f}%)")
                    
            else:
                print("\n❌ Dual optimization structure not found in response")
                print(json.dumps(result, indent=2))
        else:
            print(f"\n❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("\n⏱ Request timed out (optimization takes 1-2 minutes)")
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Connection failed - is the server running at {BACKEND_URL}?")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")

def test_get_pricing():
    """Test the /get_pricing endpoint"""
    print("\n\n" + "=" * 60)
    print("Testing Get Pricing Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/get_pricing")
        
        if response.status_code == 200:
            pricing = response.json()
            print("\n✓ Current Pricing Configuration:")
            print("-" * 60)
            for key, value in pricing.items():
                print(f"  {key}: ${value:.2f}")
        else:
            print(f"❌ Failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_optimization_history():
    """Test the /optimization_history endpoint"""
    print("\n\n" + "=" * 60)
    print("Testing Optimization History Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/optimization_history")
        
        if response.status_code == 200:
            history = response.json()
            
            if history:
                print(f"\n✓ Found {len(history)} optimization runs")
                
                # Show latest run details
                latest = history[-1]
                print(f"\n📈 Latest Optimization Run:")
                print("-" * 60)
                print(f"  Timestamp: {latest.get('timestamp', 'N/A')}")
                print(f"  Limit Type: {latest.get('limit_type', 'N/A')}")
                print(f"  Trials: {len(latest.get('trials', []))}")
                
                if latest.get('trials'):
                    trials = latest['trials']
                    print(f"\n  Best Trial:")
                    print(f"    Trial #{trials[-1]['number']}")
                    print(f"    Value: {trials[-1]['value']:.4f}")
            else:
                print("\n⚠ No optimization history found (run optimization first)")
        else:
            print(f"❌ Failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print(f"\n🚀 Starting Optimization Tests - {datetime.now()}")
    print(f"Backend: {BACKEND_URL}\n")
    
    # Run tests
    test_get_pricing()
    test_optimization_history()
    test_optimize_targets()
    
    print("\n\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)
