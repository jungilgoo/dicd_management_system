"""
calculate_basic_statistics() 함수 검증 테스트

DB 연결 없이 순수 통계 계산 로직만 검증합니다.
"""
import pytest
from backend.services.statistics import calculate_basic_statistics


class TestCalculateBasicStatistics:
    """기본 통계 계산 검증"""

    def test_normal_values(self):
        """일반적인 5포인트 측정값"""
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 3.0
        assert result["min"] == 1.0
        assert result["max"] == 5.0
        assert result["range"] == 4.0
        assert result["std_dev"] == 1.581  # stdev([1,2,3,4,5]) = 1.5811...

    def test_identical_values(self):
        """모든 측정값이 동일한 경우"""
        values = [2.500, 2.500, 2.500, 2.500, 2.500]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 2.5
        assert result["min"] == 2.5
        assert result["max"] == 2.5
        assert result["range"] == 0.0
        assert result["std_dev"] == 0.0

    def test_realistic_dicd_values(self):
        """실제 DICD 측정값 범위 (마이크로미터 단위)"""
        values = [1.234, 1.238, 1.230, 1.236, 1.232]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 1.234
        assert result["min"] == 1.230
        assert result["max"] == 1.238
        assert result["range"] == 0.008
        assert result["std_dev"] == 0.003

    def test_rounding_to_3_decimals(self):
        """소수점 3자리 반올림 확인"""
        values = [1.1111, 2.2222, 3.3333, 4.4444, 5.5555]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 3.333  # 3.33330 → 3.333
        assert result["min"] == 1.111
        assert result["max"] == 5.556  # 5.5555 → 5.556
        assert result["range"] == 4.444  # 원본 값 기반: 5.5555 - 1.1111 = 4.4444

    def test_range_calculated_from_original_values(self):
        """range가 반올림 전 원본 값에서 계산되는지 확인 (이전 버그 검증)"""
        # 반올림 시 min=1.235, max=1.235 → range=0.000 이 되면 안됨
        values = [1.2346, 1.2351, 1.2348, 1.2349, 1.2350]
        result = calculate_basic_statistics(values)

        # 원본 기준: max=1.2351, min=1.2346 → range=0.0005 → round=0.001
        assert result["range"] == 0.001

    def test_empty_values(self):
        """빈 리스트 처리"""
        result = calculate_basic_statistics([])

        assert result["avg"] is None
        assert result["min"] is None
        assert result["max"] is None
        assert result["range"] is None
        assert result["std_dev"] is None

    def test_single_value(self):
        """값이 1개인 경우 (표준편차 0)"""
        result = calculate_basic_statistics([3.0])

        assert result["avg"] == 3.0
        assert result["min"] == 3.0
        assert result["max"] == 3.0
        assert result["range"] == 0.0
        assert result["std_dev"] == 0.0

    def test_two_values(self):
        """값이 2개인 경우"""
        result = calculate_basic_statistics([1.0, 3.0])

        assert result["avg"] == 2.0
        assert result["min"] == 1.0
        assert result["max"] == 3.0
        assert result["range"] == 2.0
        assert result["std_dev"] == 1.414  # stdev([1,3]) = 1.41421...

    def test_negative_values(self):
        """음수 값 처리 (비정상이지만 계산은 되어야 함)"""
        values = [-1.0, 0.0, 1.0, 2.0, 3.0]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 1.0
        assert result["min"] == -1.0
        assert result["max"] == 3.0
        assert result["range"] == 4.0

    def test_large_spread_values(self):
        """큰 범위의 측정값"""
        values = [100.0, 200.0, 300.0, 400.0, 500.0]
        result = calculate_basic_statistics(values)

        assert result["avg"] == 300.0
        assert result["min"] == 100.0
        assert result["max"] == 500.0
        assert result["range"] == 400.0
        assert result["std_dev"] == 158.114  # stdev * 100
