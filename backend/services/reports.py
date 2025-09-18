import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import base64
from io import BytesIO
from sqlalchemy.orm import Session
from fastapi import HTTPException

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing, Line
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie

from ..database import models
from . import statistics, spc

def generate_weekly_report(db: Session, target_id: int, report_date: Optional[datetime] = None) -> BytesIO:
    """
    주간 보고서 생성
    """
    # 보고서 날짜 설정 (기본: 현재 날짜)
    if report_date is None:
        report_date = datetime.now()
    
    # 주간 날짜 범위 계산 (월요일~일요일 기준)
    end_date = report_date
    days_since_monday = report_date.weekday()
    start_date = report_date - timedelta(days=days_since_monday, weeks=1)
    end_date = start_date + timedelta(days=6)
    
    # 타겟 정보 조회
    target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    process = db.query(models.Process).filter(models.Process.id == target.process_id).first()
    product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == process.product_group_id).first()
    
    # 활성 SPEC 정보 조회
    spec = db.query(models.Spec).filter(
        models.Spec.target_id == target_id,
        models.Spec.is_active == True
    ).first()
    
    # 측정 데이터 조회
    measurements = db.query(models.Measurement).filter(
        models.Measurement.target_id == target_id,
        models.Measurement.created_at >= start_date,
        models.Measurement.created_at <= end_date
    ).order_by(models.Measurement.created_at.asc()).all()
    
    # 통계 분석 수행
    stats_data = statistics.get_process_statistics(
        db, target_id=target_id, start_date=start_date, end_date=end_date
    )
    
    # SPC 분석 수행
    spc_data = spc.analyze_spc(
        db, target_id=target_id, days=7
    )
    
    # PDF 생성을 위한 버퍼
    buffer = BytesIO()
    
    # PDF 문서 생성
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # 스타일 설정
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    heading2_style = styles['Heading2']
    normal_style = styles['Normal']
    
    # 보고서 내용 생성
    content = []
    
    # 제목
    title = Paragraph(f"주간 품질 보고서: {product_group.name} - {process.name} - {target.name}", title_style)
    content.append(title)
    content.append(Spacer(1, 0.25*inch))
    
    # 기본 정보
    content.append(Paragraph(f"기간: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}", normal_style))
    content.append(Paragraph(f"제품군: {product_group.name}", normal_style))
    content.append(Paragraph(f"공정: {process.name}", normal_style))
    content.append(Paragraph(f"타겟: {target.name}", normal_style))
    if spec:
        content.append(Paragraph(f"SPEC 범위: LSL={spec.lsl}, USL={spec.usl}", normal_style))
    content.append(Spacer(1, 0.25*inch))
    
    # 요약 섹션
    content.append(Paragraph("주간 요약", heading2_style))
    content.append(Spacer(1, 0.1*inch))
    
    # 측정 데이터 요약
    data = []
    data.append(["항목", "값"])
    data.append(["측정 횟수", len(measurements)])
    if stats_data.get("overall_statistics"):
        overall = stats_data["overall_statistics"]
        data.append(["평균", f"{overall.get('avg', 'N/A'):.3f}"])
        data.append(["표준편차", f"{overall.get('std_dev', 'N/A'):.3f}"])
        data.append(["최소값", f"{overall.get('min', 'N/A'):.3f}"])
        data.append(["최대값", f"{overall.get('max', 'N/A'):.3f}"])
        data.append(["범위", f"{overall.get('range', 'N/A'):.3f}"])
    
    if stats_data.get("process_capability"):
        pc = stats_data["process_capability"]
        data.append(["Cp", f"{pc.get('cp', 'N/A'):.3f}"])
        data.append(["Cpk", f"{pc.get('cpk', 'N/A'):.3f}"])
    
    # 요약 테이블 생성
    summary_table = Table(data, colWidths=[2*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.black),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (1, 0), 12),
        ('GRID', (0, 0), (1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (1, -1), 'MIDDLE'),
    ]))
    
    content.append(summary_table)
    content.append(Spacer(1, 0.25*inch))
    
    # SPC 분석 결과
    content.append(Paragraph("SPC 분석 결과", heading2_style))
    content.append(Spacer(1, 0.1*inch))
    
    if spc_data.get("control_limits"):
        cl = spc_data["control_limits"]
        content.append(Paragraph(f"관리 한계: CL={cl.get('cl', 'N/A'):.3f}, UCL={cl.get('ucl', 'N/A'):.3f}, LCL={cl.get('lcl', 'N/A'):.3f}", normal_style))
    
    # SPC 패턴 감지 결과
    if spc_data.get("patterns") and len(spc_data["patterns"]) > 0:
        content.append(Paragraph("감지된 패턴:", normal_style))
        for pattern in spc_data["patterns"]:
            rule = pattern.get("rule")
            desc = pattern.get("description")
            pos = pattern.get("position")
            content.append(Paragraph(f"- Rule {rule}: {desc} (위치: {pos})", normal_style))
    else:
        content.append(Paragraph("감지된 패턴 없음", normal_style))
    
    content.append(Spacer(1, 0.25*inch))
    
    # 측정 데이터 표
    content.append(Paragraph("측정 데이터", heading2_style))
    content.append(Spacer(1, 0.1*inch))
    
    if measurements:
        # 테이블 헤더
        table_data = [["날짜", "LOT NO", "WAFER NO", "평균", "최소", "최대", "범위", "표준편차"]]
        
        # 테이블 데이터
        for m in measurements:
            date_str = m.created_at.strftime("%Y-%m-%d")
            table_data.append([
                date_str,
                m.lot_no,
                m.wafer_no,
                f"{m.avg_value:.3f}",
                f"{m.min_value:.3f}",
                f"{m.max_value:.3f}",
                f"{m.range_value:.3f}",
                f"{m.std_dev:.3f}"
            ])
        
        # 테이블 생성
        meas_table = Table(table_data, colWidths=[0.8*inch, 1*inch, 0.8*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch])
        meas_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ]))
        
        content.append(meas_table)
    else:
        content.append(Paragraph("측정 데이터 없음", normal_style))
    
    # 그래프 섹션
    if spc_data.get("data") and spc_data["data"].get("values") and len(spc_data["data"]["values"]) > 0:
        content.append(PageBreak())
        content.append(Paragraph("공정 추이 분석", heading2_style))
        content.append(Spacer(1, 0.1*inch))
        
        # 데이터 준비
        values = spc_data["data"]["values"]
        dates = spc_data["data"]["dates"]
        dates_short = [d.split("T")[0] for d in dates]
        
        # 도면 생성
        drawing = Drawing(500, 200)
        
        # 선 차트 생성
        chart = HorizontalLineChart()
        chart.x = 50
        chart.y = 50
        chart.width = 400
        chart.height = 125
        chart.data = [values]
        
        # X축 설정
        chart.categoryAxis.categoryNames = dates_short
        chart.categoryAxis.labels.angle = 30
        chart.categoryAxis.labels.fontSize = 6
        
        # 관리 한계선 추가
        if spc_data.get("control_limits"):
            cl = spc_data["control_limits"].get("cl", 0)
            ucl = spc_data["control_limits"].get("ucl", 0)
            lcl = spc_data["control_limits"].get("lcl", 0)
            
            # 관리 한계선 추가
            if len(values) > 0:
                chart.data.append([cl] * len(values))  # CL
                chart.data.append([ucl] * len(values))  # UCL
                chart.data.append([lcl] * len(values))  # LCL
                
                # 선 스타일 설정
                chart.lines[1].strokeColor = colors.green
                chart.lines[1].strokeWidth = 1
                chart.lines[1].strokeDashArray = [3, 2]
                
                chart.lines[2].strokeColor = colors.red
                chart.lines[2].strokeWidth = 1
                chart.lines[2].strokeDashArray = [3, 2]
                
                chart.lines[3].strokeColor = colors.red
                chart.lines[3].strokeWidth = 1
                chart.lines[3].strokeDashArray = [3, 2]
        
        # SPEC 추가
        if spec:
            if len(values) > 0:
                chart.data.append([spec.usl] * len(values))  # USL
                chart.data.append([spec.lsl] * len(values))  # LSL
                
                # 선 스타일 설정
                chart.lines[4].strokeColor = colors.blue
                chart.lines[4].strokeWidth = 1.5
                
                chart.lines[5].strokeColor = colors.blue
                chart.lines[5].strokeWidth = 1.5
        
        # 차트 범례 설정
        chart.lineLabelFormat = '%2.2f'
        
        # 차트 추가
        drawing.add(chart)
        content.append(drawing)
        content.append(Spacer(1, 0.1*inch))
        content.append(Paragraph("* 녹색 점선: CL, 붉은 점선: UCL/LCL, 파란 선: SPEC(USL/LSL)", normal_style))
    
    # PDF 생성
    doc.build(content)
    buffer.seek(0)
    
    return buffer

def generate_monthly_report(db: Session, target_id: int, report_date: Optional[datetime] = None) -> BytesIO:
    """
    월간 보고서 생성 (주간 보고서와 유사하지만 날짜 범위가 한 달)
    """
    # 보고서 날짜 설정 (기본: 현재 날짜)
    if report_date is None:
        report_date = datetime.now()
    
    # 월간 날짜 범위 계산
    year = report_date.year
    month = report_date.month
    
    # 월의 첫날과 마지막 날 계산
    start_date = datetime(year, month, 1)
    
    # 다음 달의 첫날 - 1일 = 현재 달의 마지막 날
    if month == 12:
        end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1) - timedelta(days=1)
    
    # 타겟 정보 조회
    target = db.query(models.Target).filter(models.Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    process = db.query(models.Process).filter(models.Process.id == target.process_id).first()
    product_group = db.query(models.ProductGroup).filter(models.ProductGroup.id == process.product_group_id).first()
    
    # 기타 보고서 로직은 주간 보고서와 유사
    # 여기에는 월간 보고서에 특화된 추가 내용 구현
    
    # ... (주간 보고서와 유사한 구성)
    
    # PDF 생성을 위한 버퍼
    buffer = BytesIO()
    
    # 여기에 월간 보고서에 대한 PDF 생성 로직 추가
    # 주간 보고서와 유사하지만 더 많은 데이터 요약 및 추가 분석이 포함될 수 있음
    
    # 코드 간결성을 위해 월간 보고서 세부 구현은 생략
    
    return buffer

def save_report_to_database(db: Session, target_id: int, report_type: str, file_path: str, start_date: datetime, end_date: datetime) -> models.Report:
    """
    생성된 보고서 정보를 데이터베이스에 저장
    """
    report = models.Report(
        title=f"{report_type.capitalize()} Report - Target ID: {target_id}",
        report_type=report_type,
        file_path=file_path,
        start_date=start_date,
        end_date=end_date
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report

def add_report_recipient(db: Session, report_id: int, email: str) -> models.ReportRecipient:
    """
    보고서 수신자 추가
    """
    recipient = models.ReportRecipient(
        report_id=report_id,
        email=email,
        is_active=True
    )
    
    db.add(recipient)
    db.commit()
    db.refresh(recipient)
    
    return recipient