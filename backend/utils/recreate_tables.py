"""
DICD 측정 관리 시스템 - 테이블 재생성 스크립트

이 스크립트는 기존 테이블을 삭제하고 새 모델 정의에 따라 테이블을 재생성합니다.
개발 초기 단계에서만 사용하세요. 프로덕션 환경에서는 데이터 손실이 발생합니다.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sqlalchemy as sa

# 데이터베이스 연결 설정
from backend.database.database import SQLALCHEMY_DATABASE_URL, Base
from backend.database import models  # 새 모델 정의 가져오기

def recreate_tables():
    print("경고: 이 작업은 기존 테이블을 모두 삭제하고 새로 생성합니다.")
    confirmation = input("계속하시겠습니까? (y/n): ")
    
    if confirmation.lower() != 'y':
        print("작업이 취소되었습니다.")
        return
    
    # 데이터베이스 연결
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    try:
        # 모든 테이블 삭제
        Base.metadata.drop_all(bind=engine)
        print("기존 테이블이 모두 삭제되었습니다.")
        
        # 새 테이블 생성
        Base.metadata.create_all(bind=engine)
        print("새 테이블이 생성되었습니다.")
        
        print("테이블 재생성이 완료되었습니다.")
        
    except Exception as e:
        print(f"오류 발생: {e}")
        print("작업이 실패했습니다.")

if __name__ == "__main__":
    recreate_tables()