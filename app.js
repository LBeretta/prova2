const { PDFDocument, StandardFonts, rgb } = PDFLib;

let templateConfig;
let latestUrl;

const activityOptions = [
  'Arrivo',
  'Arrivo e welcome coffee',
  "Visita all'Experience Center",
  'Pranzo',
  'Attività ludica',
  'Cena',
  'Pausa caffè'
];


const form = document.getElementById('pdfForm');
const previewBtn = document.getElementById('previewBtn');
const resultPanel = document.getElementById('resultPanel');
const pdfPreview = document.getElementById('pdfPreview');
const downloadLink = document.getElementById('downloadLink');

async function loadConfig() {
  const res = await fetch('template.json');
  templateConfig = await res.json();
}

function hexToRgb01(hex) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function getValue(name) {
  return String(new FormData(form).get(name) || '').trim();
}

function formatItalianDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatItalianDateWithoutYear(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long'
  }).format(date);
}

function formatRsvpText(value) {
  const formattedDate = formatItalianDateWithoutYear(value);
  return formattedDate ? `RSVP entro il ${formattedDate}` : '';
}

function populateTimeSelects() {
  const options = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 7 && minute === 0) continue;
      if (hour === 23 && minute === 30) continue;
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push(label);
    }
  }

  for (let index = 1; index <= 5; index += 1) {
    const select = document.getElementById(`orario${index}`);
    if (!select) continue;
    options.forEach((time) => {
      const option = document.createElement('option');
      option.value = time;
      option.textContent = time;
      select.appendChild(option);
    });
  }
}

function populateActivitySelects() {
  for (let index = 1; index <= 5; index += 1) {
    const select = document.getElementById(`att${index}`);
    const customInput = document.getElementById(`att${index}_custom`);
    if (!select) continue;

    activityOptions.forEach((activity) => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      select.appendChild(option);
    });

    const otherOption = document.createElement('option');
    otherOption.value = '__other__';
    otherOption.textContent = 'Altro';
    select.appendChild(otherOption);

    select.addEventListener('change', () => {
      const isOther = select.value === '__other__';
      if (customInput) {
        customInput.hidden = !isOther;
        customInput.required = isOther;
        if (!isOther) customInput.value = '';
        if (isOther) customInput.focus();
      }
    });
  }
}

function getActivityValue(index) {
  const selected = getValue(`att${index}`);
  if (selected === '__other__') return getValue(`att${index}_custom`);
  return selected;
}

function buildAgendaText(index) {
  const time = getValue(`orario${index}`);
  const activity = getActivityValue(index);
  if (time && activity) return `${time} - ${activity}`;
  return time || activity;
}

function drawAlignedText(page, text, box, font, color) {
  if (!text) return;
  const size = box.fontSize || 14;
  let printable = text;
  let textWidth = font.widthOfTextAtSize(printable, size);
  while (textWidth > box.width && printable.length > 3) {
    printable = printable.slice(0, -2).trim() + '...';
    textWidth = font.widthOfTextAtSize(printable, size);
  }

  let x = box.x;
  if (box.align === 'right') x = box.x + box.width - textWidth;
  if (box.align === 'center') x = box.x + (box.width - textWidth) / 2;

  page.drawText(printable, {
    x,
    y: box.y,
    size,
    font,
    color,
    maxWidth: box.width
  });
}

async function generatePdf() {
  if (!templateConfig) await loadConfig();
  const templateBytes = await fetch(templateConfig.template).then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const white = hexToRgb01(templateConfig.styles.textColor);

  drawAlignedText(page, formatItalianDate(getValue('data1')), templateConfig.fields.data1, boldFont, white);
  drawAlignedText(page, templateConfig.fixedFields.luogo1.value, templateConfig.fixedFields.luogo1, font, white);
  for (let i = 1; i <= 5; i += 1) {
    drawAlignedText(page, buildAgendaText(i), templateConfig.drawFields[`orario${i}_att${i}`], font, white);
  }
  drawAlignedText(page, formatRsvpText(getValue('data2')), templateConfig.fields.data2, boldFont, white);

  return await pdfDoc.save();
}

function showPdf(bytes, downloadImmediately = false) {
  if (latestUrl) URL.revokeObjectURL(latestUrl);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  latestUrl = URL.createObjectURL(blob);
  pdfPreview.src = latestUrl;
  downloadLink.href = latestUrl;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (downloadImmediately) downloadLink.click();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showPdf(await generatePdf(), true);
  } catch (error) {
    alert(`Errore durante la generazione del PDF: ${error.message}`);
  }
});

previewBtn.addEventListener('click', async () => {
  try {
    showPdf(await generatePdf(), false);
  } catch (error) {
    alert(`Errore durante la generazione dell'anteprima: ${error.message}`);
  }
});

document.getElementById('fillDemo').addEventListener('click', () => {
  const values = {
    data1: '2026-09-18',
    orario1: '09:00', att1: 'Arrivo e welcome coffee',
    orario2: '10:00', att2: "Visita all'Experience Center",
    orario3: '12:30', att3: 'Pranzo',
    orario4: '15:00', att4: 'Attività ludica',
    orario5: '17:30', att5: 'Pausa caffè',
    data2: '2026-09-19'
  };
  Object.entries(values).forEach(([key, value]) => {
    const input = document.getElementById(key);
    if (input) input.value = value;
    if (input && input.classList.contains('activity-select')) input.dispatchEvent(new Event('change'));
  });
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
});

populateTimeSelects();
populateActivitySelects();
loadConfig();
