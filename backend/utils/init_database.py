"""
DICD 측정 관리 시스템 - 초기 데이터 생성 스크립트 (업데이트 버전)

이 스크립트는 테이블 재생성 후 기본 데이터를 새로 삽입합니다.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from backend.database import models, database

def init_database(db: Session):
    # 제품군 추가
    product_groups = [
        {"name": "IC", "description": "IC 제품군"},
        {"name": "FET", "description": "FET 제품군"},
        {"name": "DIODE", "description": "DIODE 제품군"},
        {"name": "RF", "description": "RF 제품군"}
    ]
    
    # 공정 정보
    processes_info = {
        "IC": ["BUR", "BOT", "ISO", "EXB", "BA1", "HIR", "EMI", "CNT", "ME1", "VIA", "ME2"],
        "FET": ["ACT", "PPL", "RNG", "PLY", "NPL", "CNT"],
        "DIODE": ["ACT"],
        "RF": ["PLY", "CNT"]
    }
    
    # 타겟 정보
    targets_info = {
        "IC": {
            "BUR": ["1.0", "3.2"],
            "BOT": ["2.0"],
            "ISO": ["2.0", "4.8"],
            "EXB": ["2.0", "2.5", "3.4"],
            "BA1": ["1.5", "2.0", "2.5", "3.4"],
            "HIR": ["2.6"],
            "EMI": ["2.0", "2.5", "3.4"],
            "CNT": ["1.65", "2.1", "2.6"],
            "ME1": ["1.8", "4.0"],
            "VIA": ["3.0", "3.1", "5.0"],
            "ME2": ["3.0", "4.0"]
        },
        "FET": {
            "ACT": ["3.0", "3.5"],
            "PPL": ["2.0", "2.5"],
            "RNG": ["3.0", "3.5", "5.5", "6.0"],
            "PLY": ["5.2", "7.4", "7.5", "8.5", "9.0", "11.0"],
            "NPL": ["3.8", "6.0", "7.0"],
            "CNT": ["2.0", "2.5", "2.6", "3.0"]
        },
        "DIODE": {
            "ACT": ["1.6"]
        },
        "RF": {
            "PLY": ["3.0", "5.0"],
            "CNT": ["3.0"]
        }
    }
    
    # 장비 정보
    equipment_info = {
        "코팅": ["1호기 1라인", "1호기 2라인", "2호기 2라인", "Coater 3C", "4호기", "5호기", "6호기"],
        "노광": ["1호기", "2호기", "3호기", "4호기", "5호기", "11D"],
        "현상": ["1호기", "2호기", "5호기", "6호기"]
    }
    
    # 데이터베이스에 제품군 추가
    product_group_dict = {}
    for pg_data in product_groups:
        product_group = models.ProductGroup(
            name=pg_data["name"],
            description=pg_data["description"]
        )
        db.add(product_group)
        db.flush()  # ID를 얻기 위해 flush
        product_group_dict[pg_data["name"]] = product_group.id
        print(f"제품군 '{pg_data['name']}' 추가됨, ID: {product_group.id}")
    
    # 데이터베이스에 공정 추가
    process_dict = {}
    for pg_name, processes in processes_info.items():
        pg_id = product_group_dict[pg_name]
        for process_name in processes:
            process = models.Process(
                product_group_id=pg_id,
                name=process_name,
                description=f"{pg_name} 제품군의 {process_name} 공정"
            )
            db.add(process)
            db.flush()  # ID를 얻기 위해 flush
            process_key = f"{pg_name}_{process_name}"
            process_dict[process_key] = process.id
            print(f"공정 '{process_name}' 추가됨 (제품군: {pg_name}), ID: {process.id}")
    
    # 데이터베이스에 타겟 추가 및 SPEC 생성
    target_dict = {}
    spec_count = 0
    for pg_name, processes in targets_info.items():
        for process_name, targets in processes.items():
            process_key = f"{pg_name}_{process_name}"
            process_id = process_dict.get(process_key)
            if process_id:
                for target_value in targets:
                    # 타겟 추가
                    target = models.Target(
                        process_id=process_id,
                        name=target_value,
                        description=f"{pg_name} 제품군의 {process_name} 공정의 {target_value} 타겟"
                    )
                    db.add(target)
                    db.flush()  # ID를 얻기 위해 flush
                    target_key = f"{pg_name}_{process_name}_{target_value}"
                    target_dict[target_key] = target.id
                    print(f"타겟 '{target_value}' 추가됨 (제품군: {pg_name}, 공정: {process_name}), ID: {target.id}")
                    
                    # 타겟에 대한 SPEC 추가 (타겟값 ±0.2)
                    target_value_float = float(target_value)
                    lsl = round(target_value_float - 0.2, 2)
                    usl = round(target_value_float + 0.2, 2)
                    
                    spec = models.Spec(
                        target_id=target.id,
                        lsl=lsl,
                        usl=usl,
                        is_active=True,
                        reason="초기 SPEC 설정 (타겟값 ±0.2)"
                    )
                    db.add(spec)
                    spec_count += 1
                    print(f"SPEC 추가됨 (타겟: {target_value}, LSL: {lsl}, USL: {usl})")
    
    # 장비 추가
    equipment_dict = {}  # 추가: 장비 ID를 저장할 딕셔너리
    equipment_count = 0
    for eq_type, equipments in equipment_info.items():
        for eq_name in equipments:
            equipment = models.Equipment(
                name=f"{eq_type} {eq_name}",
                type=eq_type,
                description=f"{eq_type} {eq_name} 장비",
                is_active=True
            )
            db.add(equipment)
            db.flush()  # ID를 얻기 위해 flush
            equipment_count += 1
            equipment_key = f"{eq_type}_{eq_name}"
            equipment_dict[equipment_key] = equipment.id  # 추가: 장비 ID 저장
            print(f"장비 '{eq_type} {eq_name}' 추가됨, ID: {equipment.id}")
    
    # 변경사항 커밋
    db.commit()
    
    print("\n데이터베이스 초기화가 완료되었습니다.")
    return {
        "product_groups": len(product_group_dict),
        "processes": len(process_dict),
        "targets": len(target_dict),
        "specs": spec_count,
        "equipments": equipment_count
    }

if __name__ == "__main__":
    db = database.SessionLocal()
    try:
        result = init_database(db)
        print(f"\n총 {result['product_groups']}개의 제품군, {result['processes']}개의 공정, {result['targets']}개의 타겟, {result['specs']}개의 SPEC, {result['equipments']}개의 장비가 추가되었습니다.")
    except Exception as e:
        print(f"오류 발생: {e}")
    finally:
        db.close()