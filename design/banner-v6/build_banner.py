"""Rebuild the 600 x 1800 mm X-banner. Typography and QR remain vector in PDF."""
from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
MM = 72 / 25.4
W, H = 600, 1800
NAVY, CORAL, BLUE, MINT, YELLOW = map(HexColor, ['#182943','#FF5266','#299FE7','#58BBA9','#FFD45E'])
CREAM, MUTED, LINE = map(HexColor, ['#FFF9EE','#5B6675','#E5DCCB'])
URL = 'https://hichoni.github.io/3d-modeling/index.html?start'
pdfmetrics.registerFont(TTFont('Jua', str(ROOT / 'fonts/Jua-Regular.ttf')))
pdfmetrics.registerFont(TTFont('DoHyeon', str(ROOT / 'fonts/DoHyeon-Regular.ttf')))

def build(bleed=0):
    suffix = '-bleed3mm' if bleed else ''
    file = OUT / f'click-booth-x-banner-v6-600x1800{suffix}.pdf'
    c = canvas.Canvas(str(file), pagesize=((W+2*bleed)*MM,(H+2*bleed)*MM), pageCompression=1)
    c.setTitle('상상을 클릭하다! 3D 키캡 클리커 만들기 | X배너 v6')
    c.setAuthor('AIERA 안동발명교육연구회 / 풍천풍서초 발명동아리 WNL')
    c.scale(MM,MM); c.translate(bleed,bleed)
    def box(x,y,w,h,r,fill,stroke=None,lw=1):
        c.setFillColor(fill); c.setStrokeColor(stroke or fill); c.setLineWidth(lw)
        c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))
    def text(x,y,s,size=20,color=NAVY,font='Jua',align='left'):
        c.setFillColor(color); c.setFont(font,size)
        method={'left':c.drawString,'center':c.drawCentredString,'right':c.drawRightString}[align]
        method(x,H-y-size*.82,s)
    def line(x1,y1,x2,y2,color=LINE,lw=1):
        c.setStrokeColor(color);c.setLineWidth(lw);c.line(x1,H-y1,x2,H-y2)
    def star(x,y,r,color):
        p=c.beginPath()
        for i in range(8):
            a=math.pi*i/4; radius=r if i%2==0 else r*.24
            px=x+math.cos(a)*radius;py=H-y+math.sin(a)*radius
            (p.moveTo if i==0 else p.lineTo)(px,py)
        p.close();c.setFillColor(color);c.drawPath(p,fill=1,stroke=0)
    def circle(x,y,r,color):
        c.setFillColor(color);c.circle(x,H-y,r,stroke=0,fill=1)

    box(-bleed,-bleed,W+2*bleed,H+2*bleed,0,CREAM)
    # A sparse dot grid gives the workbench a tactile paper feel without competing with text.
    for x in range(18,600,18):
        for y in range(92,1585,18):
            circle(x,y,.52,HexColor('#F0E9DB'))

    box(33,38,258,42,21,HexColor('#E4D8BF'))
    box(31,34,258,42,21,white,NAVY,1.2)
    box(36,40,64,30,15,CORAL)
    text(68,46,'AIERA',18,white,'DoHyeon','center')
    text(110,47,'안동발명교육연구회',16,NAVY,'DoHyeon')
    box(312,38,258,42,21,HexColor('#D5E7E2'))
    box(310,34,258,42,21,white,NAVY,1.2)
    text(323,48,'풍천풍서초 발명동아리',14,NAVY,'DoHyeon')
    box(513,40,49,30,15,BLUE)
    text(537.5,46,'WNL',19,white,'DoHyeon','center')
    # Project authorship supplied by AIERA: booth models and the dedicated experience app.
    box(35,96,530,34,17,NAVY)
    credit=[('모델링부터 앱까지, ',white),('AIERA 100%',YELLOW),(' 자체 개발',white)]
    tx=300-sum(pdfmetrics.stringWidth(s,'DoHyeon',20) for s,_ in credit)/2
    for words,color in credit:
        text(tx,104,words,20,color,'DoHyeon');tx+=pdfmetrics.stringWidth(words,'DoHyeon',20)


    text(300,143,'상상을',105,NAVY,align='center')
    text(300,250,'클릭하다!',118,HexColor('#DF3A51'),align='center')
    text(300,245,'클릭하다!',118,CORAL,align='center')
    star(48,193,16,YELLOW);star(551,145,14,BLUE);star(554,350,15,MINT);star(56,360,9,CORAL)
    circle(540,201,5,YELLOW);circle(72,136,4,MINT)
    text(300,375,'3D 키캡 클리커 만들기',34,NAVY,align='center')

    c.saveState();c.translate(300,H-463);c.rotate(2);c.translate(-300,-(H-463))
    box(35,436,530,66,24,HexColor('#101E34'))
    box(35,431,530,66,24,NAVY)
    phrase=[('내 이름이 ',white),('3D 키캡',YELLOW),('이 되는 5분',white)]
    tx=300-sum(pdfmetrics.stringWidth(s,'Jua',30) for s,_ in phrase)/2
    for words,color in phrase:
        text(tx,442,words,30,color);tx+=pdfmetrics.stringWidth(words,'Jua',30)
    text(300,479,'디자인 체험 약 5분 / 출력 시간은 별도예요',11,HexColor('#E1E9F4'),'DoHyeon','center')
    c.restoreState()

    # Exact current kit STLs + production-generated 14 mm inserts. Colors are illustrative.
    box(25,532,550,390,42,HexColor('#FFF3D5'),HexColor('#E9DAB7'),1.2)
    circle(298,729,168,HexColor('#FFFDF7'))
    c.drawImage(ImageReader(str(ROOT/'design/banner-v4/keycap-actual-models.png')),24,H-850,552,552*2500/3600,mask='auto')
    box(45,551,181,43,20,white,NAVY,1.1)
    text(135.5,563,'실제 모델 그대로!',20,NAVY,align='center')
    # A little idea lamp fills the upper-right corner without covering the real parts.
    circle(520,584,29,white)
    circle(520,579,13,YELLOW)
    c.saveState();c.setStrokeColor(NAVY);c.setLineWidth(1.4)
    c.circle(520,H-579,13,fill=0,stroke=1)
    line(515,594,525,594,NAVY,2);line(516,599,524,599,NAVY,2)
    line(517,582,520,586,NAVY,1.4);line(523,582,520,586,NAVY,1.4)
    line(520,586,520,592,NAVY,1.4)
    for dx,dy in [(-23,0),(23,0),(0,-23),(-17,-17),(17,-17)]:
        line(520+dx,579+dy,520+dx*1.22,579+dy*1.22,CORAL,2)
    c.restoreState()
    text(520,617,'아이디어 ON!',12,NAVY,'DoHyeon','center')
    star(551,651,10,YELLOW);star(60,743,12,BLUE)
    star(156,758,7,MINT);circle(72,782,3,CORAL);circle(544,680,3,BLUE)

    # A note and short pointer identify the loose insert. No substitute product drawings.
    c.saveState();c.translate(246,H-796);c.rotate(5);c.translate(-246,-(H-796))
    box(166,768,160,65,16,HexColor('#E5DCCB'))
    box(163,764,160,65,16,white,HexColor('#A7DAD1'),1.3)
    box(216,756,54,14,3,HexColor('#BCE7DB'))
    text(243,779,'내가 만든 모양을',16,MUTED,'DoHyeon','center')
    text(243,802,'쏙! 끼워요',25,NAVY,align='center')
    c.restoreState()
    c.saveState();c.setStrokeColor(CORAL);c.setLineWidth(2);c.setLineCap(1)
    p=c.beginPath();p.moveTo(327,H-801);p.curveTo(337,H-805,340,H-795,347,H-794);c.drawPath(p,fill=0,stroke=1)
    line(341,790,347,794,CORAL,2);line(341,799,347,794,CORAL,2)
    c.restoreState()

    # The long dotted arrow leads from the loose plate to the fitted keycap.
    c.saveState();c.setStrokeColor(BLUE);c.setLineWidth(2);c.setLineCap(1);c.setDash(2,5)
    p=c.beginPath();p.moveTo(426,H-788);p.curveTo(518,H-803,541,H-699,482,H-665);c.drawPath(p,fill=0,stroke=1)
    c.setDash();line(483,677,482,665,BLUE,2.3);line(493,667,482,665,BLUE,2.3)
    c.restoreState()
    box(480,724,71,26,13,HexColor('#E3F3FF'))
    text(515.5,731,'착!',17,BLUE,align='center')

    # Comic click burst and a completion seal bring energy to the lower-right space.
    p=c.beginPath()
    for i in range(24):
        a=2*math.pi*i/24;r=43 if i%2==0 else 35
        px=510+math.cos(a)*r;py=H-819+math.sin(a)*r*.72
        (p.moveTo if i==0 else p.lineTo)(px,py)
    p.close();c.setFillColor(HexColor('#FFE6A0'));c.setStrokeColor(HexColor('#F1C75B'));c.setLineWidth(1);c.drawPath(p,fill=1,stroke=1)
    text(510,807,'딸깍!',29,HexColor('#D78B0D'),align='center')
    box(424,867,130,32,16,MINT)
    text(489,875,'나만의 작품 완성!',16,white,'DoHyeon','center')
    star(417,846,8,CORAL);star(443,911,6,BLUE)
    # Small confetti stays around the content rather than on the geometry.
    line(65,602,70,609,MINT,2.6);line(553,774,558,782,CORAL,2.6)
    circle(403,909,2.8,YELLOW);circle(539,909,2.2,CORAL)

    # A vector keycap mascot and speech bubble restore the playful booth character.
    line(76,879,73,904,NAVY,8);line(116,879,121,901,NAVY,8)
    line(56,849,39,862,CORAL,6);line(137,847,151,834,CORAL,6)
    box(51,810,89,80,25,white,CORAL,6)
    circle(80,839,5,NAVY);circle(112,839,5,NAVY)
    circle(70,857,5,HexColor('#FFCAD1'));circle(123,857,5,HexColor('#FFCAD1'))
    c.setFillColor(NAVY);c.wedge(83,H-874,109,H-851,180,180,stroke=0,fill=1)
    box(159,846,240,49,20,white,NAVY,1.5)
    p=c.beginPath();p.moveTo(160,H-865);p.lineTo(145,H-876);p.lineTo(160,H-882);c.setFillColor(white);c.setStrokeColor(NAVY);c.setLineWidth(1.5);c.drawPath(p,fill=1,stroke=1)
    text(279,859,'눌러봐! 딸깍~',27,NAVY,align='center')

    text(36,950,'이렇게 만들어요',34,NAVY)
    text(565,967,'태블릿 / 크롬북으로 직접!',15,MUTED,'DoHyeon','right')
    steps=[
        (1008,CORAL,'01','내 맘대로 만들기','이름, 이니셜, 캐릭터로 나만의 키캡 디자인'),
        (1104,BLUE,'02','층층이 쌓아보기','얇게 잘라 한 층씩 쌓이는 프린터의 비밀'),
        (1200,YELLOW,'03','진짜로 출력하기','화면에서 보던 내 작품을 3D 프린터로 출력'),
        (1296,MINT,'04','딸깍! 키링 완성','스위치에 끼우면 딸깍딸깍 나만의 클리커!'),
    ]
    for y,color,num,title,body in steps:
        box(35,y+4,530,86,23,HexColor('#E9E2D6'))
        box(35,y,530,86,23,white,LINE,.8)
        circle(77,y+43,29,color)
        text(77,y+28,num,30,NAVY if num=='03' else white,'DoHyeon','center')
        text(121,y+15,title,29,NAVY)
        text(121,y+55,body,15,MUTED,'DoHyeon')
        box(449,y-8,100,21,10,HexColor('#FFE8EC') if num=='01' else HexColor('#E5F3FA') if num=='02' else HexColor('#FFF0C1') if num=='03' else HexColor('#DFF6EF'))
        text(499,y-4,'COMPLETE' if num=='04' else 'MISSION '+num,12,NAVY,'DoHyeon','center')

    # Event is retained from the existing booth banner.
    box(25,1410,550,199,35,NAVY)
    box(238,1429,141,24,12,YELLOW)
    text(308.5,1433,'BONUS EVENT',15,NAVY,'DoHyeon','center')
    text(238,1470,'체험 완료하면',29,white)
    text(238,1507,'행운의 룰렛 돌리기!',30,YELLOW)
    text(238,1554,'간식, 키링 파츠 등',17,white,'DoHyeon')
    text(238,1578,'깜짝 선물이 기다려요',17,white,'DoHyeon')
    # Original vector roulette illustration, with no invented guarantee about prize odds.
    cx,cy,rad=126,1508,79
    circle(cx,cy,rad+4,white)
    colors=[CORAL,YELLOW,BLUE,MINT,CORAL,YELLOW,BLUE,MINT]
    for i,color in enumerate(colors):
        a=math.pi*2*i/8;b=math.pi*2*(i+1)/8;p=c.beginPath();p.moveTo(cx,H-cy)
        for k in range(13):
            t=a+(b-a)*k/12;p.lineTo(cx+rad*math.cos(t),H-cy+rad*math.sin(t))
        p.close();c.setFillColor(color);c.setStrokeColor(white);c.setLineWidth(1.5);c.drawPath(p,fill=1,stroke=1)
        angle=(a+b)/2;tx=cx+rad*.68*math.cos(angle);ty=cy-rad*.68*math.sin(angle)
        c.saveState();c.translate(tx,H-ty);c.rotate(math.degrees(angle)-90);c.setFillColor(NAVY);c.setFont('DoHyeon',10);c.drawCentredString(0,0,'간식' if i%2==0 else '키링 파츠');c.restoreState()
    circle(cx,cy,19,white);text(cx,cy-10,'GO',21,NAVY,'DoHyeon','center')
    p=c.beginPath();p.moveTo(cx-9,H-cy+rad+10);p.lineTo(cx+9,H-cy+rad+10);p.lineTo(cx,H-cy+rad-8);p.close();c.setFillColor(YELLOW);c.setStrokeColor(NAVY);c.setLineWidth(2);c.drawPath(p,fill=1,stroke=1)
    text(35,1618,'실제 STL / 앱 모델링 기반 렌더링. 색상과 선물은 현장 준비 상황에 따라 달라져요.',11,MUTED,'DoHyeon')

    line(35,1652,565,1652)
    text(35,1673,'참여 안내',23,NAVY)
    for y,label,body in [(1710,'대상','초등 3학년 ~ 중학교 3학년 권장'),(1738,'시간','출력 포함 약 20~30분'),(1766,'참여','현장 접수 / 대기 순서대로 안내')]:
        box(35,y-1,38,18,9,CORAL);text(54,y+2,label,12,white,'DoHyeon','center');text(84,y+1,body,15,NAVY,'DoHyeon')
    # QR is generated from the real destination, never generated as part of the illustration.
    box(442,1668,123,111,13,white,LINE,.8)
    qr=QrCodeWidget(URL,barLevel='M',barBorder=4);bounds=qr.getBounds();width=bounds[2]-bounds[0]
    d=Drawing(90,90,transform=[90/width,0,0,90/width,0,0]);d.add(qr)
    renderPDF.draw(d,c,458.5,H-1761)
    text(503.5,1763,'집에서도 디자인해요',9,NAVY,'DoHyeon','center')

    c.showPage();c.save()
    if bleed:
        reader=PdfReader(str(file));writer=PdfWriter();page=reader.pages[0]
        page.trimbox=RectangleObject([bleed*MM,bleed*MM,(W+bleed)*MM,(H+bleed)*MM])
        page.bleedbox=RectangleObject([0,0,(W+2*bleed)*MM,(H+2*bleed)*MM])
        writer.add_page(page);writer.add_metadata({'/Title':'상상을 클릭하다! X배너 v6 - 사방 3mm 재단 여유'})
        with file.open('wb') as out:writer.write(out)
    print(file)

if __name__=='__main__':
    build();build(3)
