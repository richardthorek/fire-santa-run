/**
 * The printable run plan for the truck's clipboard: one A4 page, big and
 * high-contrast, so the navigator can read a turn in a glance without a device.
 */
import PDFDocument from 'pdfkit';
import type { RunPlanInput } from './runPlan.js';

const MARGIN = 40;
const PAGE_BOTTOM = 800;
const INK = '#000000';
const MUTED = '#333333';
const RED = '#B01620';

function ensureRoom(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

export async function buildRunPlanPdf(input: RunPlanInput, mapImage: Buffer | null): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: `Run plan: ${input.name}` } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - MARGIN * 2;

  // Run and time
  doc.fillColor(RED).font('Helvetica-Bold').fontSize(26).text(input.name, { width });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16)
    .text(`${input.date} at ${input.startTime}${input.timeZoneLabel ? ` ${input.timeZoneLabel}` : ''}`, { width });
  doc.moveDown(0.6);

  // The map, if it could be drawn
  if (mapImage) {
    const mapHeight = 210;
    doc.image(mapImage, MARGIN, doc.y, { fit: [width, mapHeight], align: 'center' });
    doc.y += mapHeight + 10;
  }

  // Start address, the first thing the driver needs
  const start = input.stops[0];
  if (start) {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(12).text('START', { width });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(start.address ?? start.name, { width });
    doc.moveDown(0.6);
  }

  // Turn by turn: a big number, the instruction in bold, the distance to the next turn
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('TURN BY TURN', { width });
  doc.moveDown(0.3);
  input.steps.forEach((step, index) => {
    ensureRoom(doc, 40);
    const top = doc.y;
    doc.fillColor(RED).font('Helvetica-Bold').fontSize(20).text(String(index + 1), MARGIN, top, { width: 34 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text(step.instruction, MARGIN + 38, top, { width: width - 38 - 80 });
    const instructionBottom = doc.y;
    const distance = step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`;
    doc.fillColor(MUTED).font('Helvetica').fontSize(13).text(distance, MARGIN + width - 80, top + 2, { width: 80, align: 'right' });
    doc.y = Math.max(instructionBottom, doc.y);
    doc.moveDown(0.5);
    doc.strokeColor('#BBBBBB').lineWidth(0.5).moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).stroke();
    doc.moveDown(0.4);
  });

  // Stops and planned times
  doc.x = MARGIN;
  ensureRoom(doc, 60);
  doc.moveDown(0.4);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('STOPS', { width });
  doc.moveDown(0.3);
  input.stops.forEach((stop, index) => {
    ensureRoom(doc, 22);
    const top = doc.y;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(`${index + 1}. ${stop.name}`, MARGIN, top, { width: width - 90 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(stop.plannedTime ?? '', MARGIN + width - 90, top, { width: 90, align: 'right' });
    doc.moveDown(0.2);
  });

  // Footer, once, inside the bottom margin so it can't spill onto a new page
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text('Check the route before the night. Roadworks and closures can change between now and the run.', MARGIN, 790, { width, align: 'center', lineBreak: false });

  doc.end();
  return done;
}
