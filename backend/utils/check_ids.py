# backend/utils/check_ids.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import database, models

def check_database_ids():
    db = database.SessionLocal()
    try:
        # 타겟 ID 확인
        targets = db.query(models.Target).all()
        print(f"총 {len(targets)}개의 타겟이 있습니다:")
        for target in targets:
            print(f"ID: {target.id}, 이름: {target.name}, 공정 ID: {target.process_id}")
        
        # 장비 ID 확인
        equipments = db.query(models.Equipment).all()
        print(f"\n총 {len(equipments)}개의 장비가 있습니다:")
        for equipment in equipments:
            print(f"ID: {equipment.id}, 이름: {equipment.name}, 타입: {equipment.type}")
    finally:
        db.close()

if __name__ == "__main__":
    check_database_ids()