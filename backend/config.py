"""
DICD 측정 관리 시스템 환경 설정 파일
"""

import os
import json
from typing import Dict, Any, Optional
from pathlib import Path

# 기본 설정 경로
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"

# 환경 설정
class Settings:
    # 애플리케이션 정보
    APP_NAME: str = "DICD 측정 관리 시스템"
    APP_VERSION: str = "1.0.0"
    
    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    # 데이터베이스 설정
    DB_USERNAME: str = "dicd_user"
    DB_PASSWORD: str = "안전한_비밀번호"
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "dicd_management"
    DB_DRIVER: str = "mysql+mysqlconnector"
    
    # 경로 설정
    REPORTS_DIR: str = "reports"
    
    # API 설정
    CORS_ORIGINS: list = ["*"]
    API_PREFIX: str = "/api"
    
    # 기타 설정
    DEBUG: bool = False
    
    def __init__(self, env: str = "development"):
        """
        환경 설정 초기화
        
        Args:
            env: 환경 유형 (development, production)
        """
        self.ENV = env
        self._load_config()
    
    def _load_config(self):
        """
        설정 파일에서 구성 로드
        """
        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    config = json.load(f)
                
                # 현재 환경 설정 가져오기
                env_config = config.get(self.ENV, {})
                
                # 환경별 설정으로 업데이트
                for key, value in env_config.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
                
                # 환경 변수에서 오버라이드 (우선순위 높음)
                self._load_from_env()
                
            except Exception as e:
                print(f"설정 파일 로드 중 오류 발생: {e}")
        else:
            # 설정 파일이 없는 경우 기본값 사용
            self._load_from_env()
            self._create_default_config()
    
    def _load_from_env(self):
        """
        환경 변수에서 설정 로드
        """
        # 데이터베이스 설정
        if db_username := os.getenv("DICD_DB_USERNAME"):
            self.DB_USERNAME = db_username
        
        if db_password := os.getenv("DICD_DB_PASSWORD"):
            self.DB_PASSWORD = db_password
        
        if db_host := os.getenv("DICD_DB_HOST"):
            self.DB_HOST = db_host
        
        if db_port := os.getenv("DICD_DB_PORT"):
            self.DB_PORT = int(db_port)
        
        if db_name := os.getenv("DICD_DB_NAME"):
            self.DB_NAME = db_name
        
        # 서버 설정
        if port := os.getenv("DICD_PORT"):
            self.PORT = int(port)
        
        if host := os.getenv("DICD_HOST"):
            self.HOST = host
        
        # 기타 설정
        if debug := os.getenv("DICD_DEBUG"):
            self.DEBUG = debug.lower() in ("true", "1", "yes")
    
    def _create_default_config(self):
        """
        기본 설정 파일 생성
        """
        try:
            config = {
                "development": {
                    "DEBUG": True,
                    "HOST": "127.0.0.1",
                    "PORT": 8080,
                    "DB_USERNAME": "dicd_user",
                    "DB_PASSWORD": "안전한_비밀번호",
                    "DB_HOST": "localhost",
                    "DB_NAME": "dicd_management"
                },
                "production": {
                    "DEBUG": False,
                    "HOST": "0.0.0.0",
                    "PORT": 8080,
                    "DB_USERNAME": "dicd_user",
                    "DB_PASSWORD": "실제_비밀번호_입력",
                    "DB_HOST": "localhost",
                    "DB_NAME": "dicd_management"
                }
            }
            
            # 설정 파일 디렉토리 생성
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            
            # 설정 파일 작성
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=4)
                
            print(f"기본 설정 파일이 생성되었습니다: {CONFIG_PATH}")
        except Exception as e:
            print(f"기본 설정 파일 생성 중 오류 발생: {e}")
    
    @property
    def database_url(self) -> str:
        """
        SQLAlchemy용 데이터베이스 URL 생성
        """
        return f"{self.DB_DRIVER}://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    def as_dict(self) -> Dict[str, Any]:
        """
        설정을 딕셔너리로 반환 (민감한 정보 제외)
        """
        return {
            "APP_NAME": self.APP_NAME,
            "APP_VERSION": self.APP_VERSION,
            "ENV": self.ENV,
            "HOST": self.HOST,
            "PORT": self.PORT,
            "DB_HOST": self.DB_HOST,
            "DB_NAME": self.DB_NAME,
            "DEBUG": self.DEBUG,
            "REPORTS_DIR": self.REPORTS_DIR
        }

# 설정 인스턴스 생성
env = os.getenv("DICD_ENV", "development")
settings = Settings(env=env)