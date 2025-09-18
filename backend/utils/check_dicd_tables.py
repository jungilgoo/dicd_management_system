"""
DICD 테이블 상태 확인 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text

# 데이터베이스 연결 설정
from backend.database.database import engine

def check_dicd_tables():
    print("DICD 테이블 상태 확인 중...")
    
    try:
        with engine.connect() as connection:
            # 모든 테이블 목록 확인
            print("\n=== 전체 테이블 목록 ===")
            result = connection.execute(text("SHOW TABLES;"))
            tables = result.fetchall()
            
            for table in tables:
                print(f"✅ {table[0]}")
            
            # Equipment 테이블 확인
            print("\n=== Equipment 테이블 구조 ===")
            try:
                result = connection.execute(text("DESCRIBE equipments;"))
                columns = result.fetchall()
                for column in columns:
                    print(f"   - {column[0]}: {column[1]}")
                    
                # Equipment 데이터 개수 확인
                result = connection.execute(text("SELECT COUNT(*) FROM equipments;"))
                count = result.fetchone()[0]
                print(f"\n   📊 Equipment 데이터 개수: {count}개")
                
                if count > 0:
                    result = connection.execute(text("SELECT id, name FROM equipments LIMIT 5;"))
                    equipments = result.fetchall()
                    print("   📋 Equipment 샘플:")
                    for eq in equipments:
                        print(f"      ID {eq[0]}: {eq[1]}")
                        
            except Exception as e:
                print(f"   ❌ Equipment 테이블 오류: {e}")
            
            # 외래키 제약조건 확인
            print("\n=== 외래키 제약조건 상태 ===")
            result = connection.execute(text("SELECT @@FOREIGN_KEY_CHECKS;"))
            fk_status = result.fetchone()[0]
            print(f"   외래키 검사 상태: {'활성화' if fk_status == 1 else '비활성화'}")
            
            # Product Groups 테이블 확인
            print("\n=== Product Groups 테이블 ===")
            try:
                result = connection.execute(text("SELECT COUNT(*) FROM product_groups;"))
                count = result.fetchone()[0]
                print(f"   📊 Product Groups 데이터 개수: {count}개")
            except Exception as e:
                print(f"   ❌ Product Groups 오류: {e}")
            
            # Processes 테이블 확인
            print("\n=== Processes 테이블 ===")
            try:
                result = connection.execute(text("SELECT COUNT(*) FROM processes;"))
                count = result.fetchone()[0]
                print(f"   📊 Processes 데이터 개수: {count}개")
            except Exception as e:
                print(f"   ❌ Processes 오류: {e}")
                
    except Exception as e:
        print(f"❌ 전체 확인 실패: {e}")

if __name__ == "__main__":
    check_dicd_tables()