"""
Script to add LSF and limestone_to_clay_ratio to Firebase apclimits collection
Run this once to initialize the APC limits for LSF control
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        if not firebase_admin._apps:
            service_key_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
            
            if os.path.exists(service_key_path):
                cred = credentials.Certificate(service_key_path)
                firebase_admin.initialize_app(cred)
                print(f"✓ Firebase initialized with service account key")
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

def add_lsf_and_ratio_limits():
    """Add LSF and limestone_to_clay_ratio to apclimits collection"""
    db = initialize_firebase()
    
    if not db:
        print("❌ Failed to initialize Firebase")
        return
    
    try:
        # Add limestone_to_clay_ratio as MV in apclimits
        feed_ratio_limit = {
            'type': 'mv',
            'mappingKey': 'kiln.limestone_to_clay_ratio',
            'll': 3.5,  # Lower limit (conservative)
            'hl': 4.5,  # Upper limit (conservative)
        }
        
        db.collection('apclimits').document('Limestone to Clay Ratio').set(feed_ratio_limit)
        print("✓ Successfully added 'Limestone to Clay Ratio' (MV) to apclimits")
        print(f"  LL: {feed_ratio_limit['ll']}")
        print(f"  HL: {feed_ratio_limit['hl']}")
        print(f"  Mapping: {feed_ratio_limit['mappingKey']}")
        
        # Add LSF as CV in apclimits
        lsf_limit = {
            'type': 'cv',
            'mappingKey': 'kpi.lsf',
            'll': 97.5,  # Lower limit for LSF
            'hl': 98.5,  # Upper limit for LSF
        }
        
        db.collection('apclimits').document('LSF').set(lsf_limit)
        print("\n✓ Successfully added 'LSF' (CV) to apclimits")
        print(f"  LL: {lsf_limit['ll']}")
        print(f"  HL: {lsf_limit['hl']}")
        print(f"  Mapping: {lsf_limit['mappingKey']}")
        
        print("\n" + "=" * 60)
        print("Summary:")
        print("  - Limestone to Clay Ratio (MV): 3.5 - 4.5")
        print("  - LSF (CV): 97.5 - 98.5")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error adding limits: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("=" * 60)
    print("Initializing LSF Control - APC Limits")
    print("=" * 60)
    add_lsf_and_ratio_limits()
    print("\n✓ Done! You can now see and edit these limits in the APC Limits page.")
