"""
DICD 측정 관리 시스템 - PR Thickness 테이블 재생성 스크립트

이 스크립트는 PR Thickness 관련 테이블만 삭제하고 새로 생성합니다.
기존 DICD 데이터는 보존됩니다.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 데이터베이스 연결 설정
from backend.database.database import SQLALCHEMY_DATABASE_URL, engine
from backend.database import models

def recreate_pr_thickness_tables():
    print("PR Thickness 테이블 재생성을 시작합니다.")
    print("기존 DICD 데이터는 보존됩니다.")
    
    confirmation = input("PR Thickness 테이블을 재생성하시겠습니까? (y/n): ")
    
    if confirmation.lower() != 'y':
        print("작업이 취소되었습니다.")
        return
    
    try:
        # PR Thickness 테이블만 삭제
        print("기존 PR Thickness 테이블을 삭제합니다...")
        
        with engine.connect() as connection:
            # 외래 키 제약조건 때문에 measurements 테이블부터 삭제
            connection.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            connection.execute(text("DROP TABLE IF EXISTS pr_thickness_measurements;"))
            connection.execute(text("DROP TABLE IF EXISTS pr_thickness_equipments;"))
            connection.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            connection.commit()
        
        print("기존 PR Thickness 테이블이 삭제되었습니다.")
        
        # PR Thickness 테이블만 다시 생성
        print("새 PR Thickness 테이블을 생성합니다...")
        
        models.PRThicknessEquipment.__table__.create(engine, checkfirst=True)
        models.PRThicknessMeasurement.__table__.create(engine, checkfirst=True)
        
        print("새 PR Thickness 테이블이 생성되었습니다.")
        
        # 테이블 생성 확인
        print("\n생성된 테이블 확인:")
        with engine.connect() as connection:
            # PR Thickness Equipment 테이블 구조 확인
            result = connection.execute(text("DESCRIBE pr_thickness_equipments;"))
            equipment_columns = result.fetchall()
            
            print("✅ pr_thickness_equipments 테이블:")
            for column in equipment_columns:
                print(f"   - {column[0]}: {column[1]}")
            
            # PR Thickness Measurement 테이블 구조 확인
            result = connection.execute(text("DESCRIBE pr_thickness_measurements;"))
            measurement_columns = result.fetchall()
            
            print("\n✅ pr_thickness_measurements 테이블:")
            for column in measurement_columns:
                print(f"   - {column[0]}: {column[1]}")
        
        print("\n🎉 PR Thickness 테이블 재생성이 완료되었습니다!")
        print("이제 PR Thickness 기능을 정상적으로 사용할 수 있습니다.")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        print("작업이 실패했습니다.")
        return False
    
    return True

def test_pr_thickness_tables():
    """PR Thickness 테이블 생성 테스트"""
    print("\nPR Thickness 테이블 연결 테스트...")
    
    try:
        with engine.connect() as connection:
            # 테이블 존재 확인
            result = connection.execute(text("SHOW TABLES LIKE 'pr_thickness%';"))
            tables = result.fetchall()
            
            print("PR Thickness 테이블 목록:")
            for table in tables:
                print(f"✅ {table[0]}")
            
            if len(tables) == 2:
                print("✅ 모든 PR Thickness 테이블이 정상적으로 생성되었습니다.")
                return True
            else:
                print("❌ 일부 테이블이 생성되지 않았습니다.")
                return False
                
    except Exception as e:
        print(f"❌ 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("PR Thickness 테이블 재생성 도구")
    print("=" * 60)
    
    if recreate_pr_thickness_tables():
        print("\n" + "=" * 60)
        test_pr_thickness_tables()
        print("=" * 60)