import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFData {
  appName: string;
  unitIdentifier: string;
  buildingId: string;
  signerName: string;
  date: string;
  description: string;
  attachmentUrl: string;
  lang: 'he' | 'ru' | 'ar';
}

export const generateWorkConfirmationPDF = async (data: PDFData) => {
  // We use a hidden template for html2canvas to render perfectly with RTL and Hebrew
  const template = document.createElement('div');
  template.style.position = 'absolute';
  template.style.left = '-9999px';
  template.style.top = '0';
  template.style.width = '800px';
  template.style.padding = '40px';
  template.style.background = 'white';
  template.style.direction = data.lang === 'he' || data.lang === 'ar' ? 'rtl' : 'ltr';
  template.style.fontFamily = 'sans-serif';
  
  template.innerHTML = `
    <div style="border: 4px solid #1e40af; padding: 40px; border-radius: 20px;">
      <div style="text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #1e40af; margin: 0; font-size: 32px;">${data.appName}</h1>
        <p style="color: #64748b; font-weight: bold; margin-top: 5px;">אישור סיום עבודה / Work Confirmation</p>
      </div>
      
      <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
        <div>
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px; font-weight: bold;">מיקום / Location</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 10px; font-weight: 800; color: #1e293b;">
            בניין ${data.buildingId} | ${data.unitIdentifier}
          </div>
        </div>
        <div>
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px; font-weight: bold;">תאריך / Date</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 10px; font-weight: 800; color: #1e293b;">
            ${data.date}
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 40px;">
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px; font-weight: bold;">תיאור העבודה / Description</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; min-height: 100px; font-weight: 500; color: #1e293b; line-height: 1.6;">
          ${data.description}
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 40px;">
        <div style="text-align: center; width: 100%;">
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 10px; font-weight: bold;">תמונה לאישור / Confirmation Photo</p>
          <img src="${data.attachmentUrl}" style="max-width: 100%; max-height: 400px; border: 2px solid #1e40af; border-radius: 10px;" />
          <p style="font-weight: 800; color: #1e293b; margin-top: 10px;">${data.lang === 'he' ? 'אושר ע"י מנהל העבודה:' : data.lang === 'ru' ? 'Подтверждено прорабом:' : 'تمت المصادقة من قبل مدير العمل:'} ${data.signerName}</p>
        </div>
        <div style="text-align: center; width: 100%; margin-top: 20px;">
           <div style="width: 100%; height: 1px; background: #eee; margin-bottom: 10px;"></div>
           <p style="color: #cbd5e1; font-size: 10px;">מסמך זה הופק באופן דיגיטלי ע"י מערכת בדק ארזי הנגב</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(template);
  
  try {
    const canvas = await html2canvas(template, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(template);
    
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2]
    });
    
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
    return pdf;
  } catch (err) {
    document.body.removeChild(template);
    throw err;
  }
};
