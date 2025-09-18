import sys
import os

# 상위 디렉토리를 sys.path에 추가하여 백엔드 모듈을 임포트할 수 있게 함
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from backend.database import models, database

def clear_database(db: Session):
    try:
        # 삭제 순서는 외래 키 제약 조건 때문에 중요함 (자식->부모 순)
        db.query(models.SPCAlert).delete()
        db.query(models.SPCRuleChange).delete()
        db.query(models.SPCRule).delete()
        db.query(models.ReportRecipient).delete()
        db.query(models.Report).delete()
        db.query(models.Measurement).delete()
        db.query(models.Spec).delete()
        db.query(models.Target).delete()
        db.query(models.Process).delete()
        db.query(models.ProductGroup).delete()
        db.query(models.Equipment).delete()
        
        db.commit()
        print("모든 테이블이 성공적으로 비워졌습니다.")
        return True
    except Exception as e:
        db.rollback()
        print(f"오류 발생: {e}")
        return False

if __name__ == "__main__":
    db = database.SessionLocal()
    try:
        clear_database(db)
    finally:
        db.close()