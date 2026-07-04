import sys
import os
import json
import traceback
import io
import tempfile

# Set up headless matplotlib before importing pyplot
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def draw_chart(chart_info, idx):
    """
    Renders a chart using matplotlib and saves it as a temporary PNG file.
    Returns the file path.
    """
    chart_type = chart_info.get("type", "bar")
    x_col = chart_info.get("x")
    y_col = chart_info.get("y")
    data = chart_info.get("data", [])
    
    if not data or not x_col or not y_col:
        return None

    # Parse data into lists
    x_vals = []
    y_vals = []
    for row in data:
        x_vals.append(str(row.get(x_col, "")))
        try:
            y_vals.append(float(row.get(y_col, 0)))
        except (ValueError, TypeError):
            y_vals.append(0.0)

    # Truncate to top 15 values for clean visualization
    if len(x_vals) > 15:
        x_vals = x_vals[:15]
        y_vals = y_vals[:15]

    fig, ax = plt.subplots(figsize=(6, 3.5), dpi=150)
    
    # Modern professional colors
    primary_color = "#10b981"  # Emerald
    accent_colors = ["#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"]

    if chart_type == "bar":
        # Dynamic colored bars if multiple items, else uniform emerald
        colors_list = accent_colors[:len(x_vals)] if len(x_vals) <= len(accent_colors) else [primary_color] * len(x_vals)
        bars = ax.bar(x_vals, y_vals, color=colors_list, alpha=0.85, edgecolor="#e2e8f0", linewidth=0.7)
        # Add values on top of bars
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f'{height:,.0f}' if height.is_integer() else f'{height:,.2f}',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3),  # 3 points vertical offset
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=7, color="#475569")
    elif chart_type == "line":
        ax.plot(x_vals, y_vals, marker='o', color="#3b82f6", linewidth=2.5, markersize=6, markerfacecolor="#10b981", markeredgecolor="white", label=y_col)
        ax.fill_between(x_vals, y_vals, alpha=0.1, color="#3b82f6")
    elif chart_type == "pie":
        # Limit pie slice volume for readability
        if len(x_vals) > 6:
            other_y = sum(y_vals[5:])
            x_vals = x_vals[:5] + ["Other"]
            y_vals = y_vals[:5] + [other_y]
        ax.pie(y_vals, labels=x_vals, autopct='%1.1f%%', colors=accent_colors, startangle=140, 
               wedgeprops={'edgecolor': 'white', 'linewidth': 1, 'antialiased': True},
               textprops={'fontsize': 8, 'color': '#1e293b'})

    # Custom styling
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#cbd5e1')
    ax.spines['bottom'].set_color('#cbd5e1')
    ax.tick_params(colors='#475569', labelsize=8)
    
    if chart_type != "pie":
        ax.grid(axis='y', linestyle='--', alpha=0.4, color='#cbd5e1')
        plt.xticks(rotation=30, ha='right')
        ax.set_ylabel(y_col, fontsize=9, fontweight='bold', color='#1e293b')
        ax.set_xlabel(x_col, fontsize=9, fontweight='bold', color='#1e293b')

    plt.title(f"{y_col} by {x_col}", fontsize=11, fontweight='bold', pad=12, color='#0f172a')
    plt.tight_layout()
    
    temp_file = tempfile.NamedTemporaryFile(suffix=f"_chart_{idx}.png", delete=False)
    plt.savefig(temp_file.name, format="png", bbox_inches='tight')
    plt.close()
    return temp_file.name

def build_pdf():
    try:
        # Read JSON input
        input_str = sys.stdin.read()
        if not input_str:
            print(json.dumps({"error": "No input payload provided"}))
            return

        payload = json.loads(input_str)
        session_id = payload.get("session_id", "default")
        title = payload.get("title", "Dataset Executive Summary Report")
        summary_text = payload.get("summary", "This report contains dynamic analysis findings and visualizations processed by the DataAgent.ai automated pipeline.")
        insights = payload.get("insights", [])
        charts = payload.get("charts", [])
        narrative_summary = payload.get("narrative_summary", "")

        # Set up PDF output path
        pdf_path = f"/tmp/sessions/{session_id}_report.pdf"
        
        # ReportLab setup
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            rightMargin=40, leftMargin=40,
            topMargin=40, bottomMargin=40
        )
        
        styles = getSampleStyleSheet()
        
        # Define high-contrast professional colors
        primary_color = colors.HexColor("#0f172a") # Slate 900
        secondary_color = colors.HexColor("#0f766e") # Teal 700
        text_color = colors.HexColor("#334155") # Slate 700
        bg_light = colors.HexColor("#f8fafc") # Slate 50
        border_color = colors.HexColor("#e2e8f0") # Slate 200

        # Custom Paragraph Styles
        styles.add(ParagraphStyle(
            name='DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=24,
            leading=28,
            textColor=primary_color,
            spaceAfter=8
        ))
        
        styles.add(ParagraphStyle(
            name='DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#10b981"), # Emerald 500
            spaceAfter=20
        ))

        styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=primary_color,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        ))

        styles.add(ParagraphStyle(
            name='Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=text_color,
            spaceAfter=8
        ))

        styles.add(ParagraphStyle(
            name='InsightTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            textColor=primary_color
        ))

        styles.add(ParagraphStyle(
            name='InsightDesc',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13,
            textColor=text_color
        ))

        styles.add(ParagraphStyle(
            name='InsightMeta',
            parent=styles['Normal'],
            fontName='Courier-Oblique',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748b")
        ))

        story = []

        # Header Title
        story.append(Paragraph(title, styles['DocTitle']))
        story.append(Paragraph("DATAAGENT.AI EXECUTIVE ANALYSIS SUMMARY", styles['DocSubtitle']))
        
        # Decorative Header Divider
        divider_table = Table([[""]], colWidths=[doc.width], rowHeights=[2])
        divider_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), secondary_color),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(divider_table)
        story.append(Spacer(1, 15))

        # Executive Summary Section
        story.append(Paragraph("Executive Summary", styles['SectionHeading']))
        story.append(Paragraph(summary_text, styles['Body']))
        story.append(Spacer(1, 10))

        # Key Insights Section
        if insights:
            story.append(Paragraph("Key Proactive Insights", styles['SectionHeading']))
            for idx, insight in enumerate(insights):
                itype = insight.get("type", "star").upper()
                ititle = insight.get("title", f"Insight #{idx+1}")
                idesc = insight.get("description", "")
                icode = insight.get("code", "")
                ivalue = insight.get("value", "")

                # Set color label based on insight type
                if itype == "WARNING":
                    label_color = "#ef4444" # Red
                elif itype == "TREND":
                    label_color = "#3b82f6" # Blue
                else:
                    label_color = "#10b981" # Emerald

                # Construct an aesthetic side-bordered card for each insight
                insight_cell_content = [
                    Paragraph(f"<b><font color='{label_color}'>[{itype}]</font> {ititle}</b> (Metric: {ivalue})", styles['InsightTitle']),
                    Spacer(1, 3),
                    Paragraph(idesc, styles['InsightDesc'])
                ]
                if icode:
                    insight_cell_content.append(Spacer(1, 3))
                    insight_cell_content.append(Paragraph(f"Pandas Query: {icode}", styles['InsightMeta']))

                insight_table = Table([[insight_cell_content]], colWidths=[doc.width - 15])
                insight_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), bg_light),
                    ('BOX', (0,0), (-1,-1), 0.5, border_color),
                    ('LINELEFT', (0,0), (0,0), 4, colors.HexColor(label_color)),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('LEFTPADDING', (0,0), (-1,-1), 12),
                    ('RIGHTPADDING', (0,0), (-1,-1), 12),
                ]))
                
                story.append(insight_table)
                story.append(Spacer(1, 10))

        story.append(Spacer(1, 10))

        # Narrative Recap (Chat Conversation Summary)
        if narrative_summary:
            story.append(Paragraph("Analysis Discussion Recap", styles['SectionHeading']))
            story.append(Paragraph(narrative_summary, styles['Body']))
            story.append(Spacer(1, 15))

        # Charts Section
        if charts:
            story.append(Paragraph("Data Visualizations", styles['SectionHeading']))
            chart_imgs = []
            for idx, chart_info in enumerate(charts):
                img_path = draw_chart(chart_info, idx)
                if img_path and os.path.exists(img_path):
                    # Wrap matplotlib chart in ReportLab Image Flowable
                    # Scaling to fit page width elegantly (width = ~340, height = ~200)
                    chart_imgs.append((img_path, chart_info))

            # Display charts in a nice grid or vertical flow
            for img_path, cinfo in chart_imgs:
                story.append(Paragraph(f"<b>Figure:</b> {cinfo.get('y')} mapped against {cinfo.get('x')} ({cinfo.get('type')} chart)", styles['Body']))
                story.append(Spacer(1, 4))
                story.append(Image(img_path, width=380, height=220))
                story.append(Spacer(1, 15))

        # Footer page numbering helper
        def add_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.HexColor("#64748b"))
            # Standard Page number and date timestamp
            page_num = canvas.getPageNumber()
            canvas.drawString(40, 25, "DataAgent.ai Executive Report — Confidential")
            canvas.drawRightString(letter[0] - 40, 25, f"Page {page_num}")
            canvas.restoreState()

        # Build PDF
        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        
        # Print resulting PDF path as JSON to stdout
        print(json.dumps({
            "success": True,
            "pdf_path": pdf_path,
            "file_size_bytes": os.path.getsize(pdf_path)
        }))

    except Exception as e:
        print(json.dumps({
            "error": f"PDF report generation failed: {str(e)}",
            "traceback": traceback.format_exc()
        }))

if __name__ == "__main__":
    build_pdf()
