import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { buildCpaReportData, CATEGORY_TITLES } from '@/app/lib/cpaReportGenerator';
import type { CpaReportData } from '@/app/lib/cpaReportGenerator';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

function generatePDF(data: CpaReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',  ()            => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { taxpayerSummary, financialBaseline, implementedStrategies, repsSummary, totalEstimatedSavings } = data;

    // Group implemented strategies by category (fixed per strategy, unlike phase —
    // see CATEGORY_TITLES) for both the cover-page listing and the detail pages.
    // Preserves each group's original completed_at order; category order below is a
    // fixed, sensible reading order rather than alphabetical.
    const CATEGORY_ORDER = ['tax', 'retirement', 'realEstate', 'businessStructure', 'debt', 'investment', 'family', 'other'];
    const strategyGroups = CATEGORY_ORDER
      .map(category => ({
        category,
        title: CATEGORY_TITLES[category] ?? 'Other Strategies',
        strategies: implementedStrategies.filter(s => s.category === category),
      }))
      .filter(g => g.strategies.length > 0);

    const W       = doc.page.width;          // 612
    const L       = doc.page.margins.left;   // 72
    const usableW = W - L * 2;              // 468

    // ── Helper: small page header ────────────────────────────────────────────

    function pageHeader(title?: string) {
      doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af')
        .text('MoneyXprt', L, L, { continued: true })
        .text(`  ·  Tax Strategy Summary — ${taxpayerSummary.taxYear}`, { align: 'left' });
      doc.moveTo(L, L + 14).lineTo(W - L, L + 14)
        .strokeColor('#d1d5db').lineWidth(0.5).stroke();
      if (title) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827')
          .text(title, L, L + 26, { width: usableW });
        doc.y = L + 52;
      } else {
        doc.y = L + 24;
      }
    }

    // ── Helper: horizontal rule ───────────────────────────────────────────────

    function rule(color = '#e5e7eb') {
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y)
        .strokeColor(color).lineWidth(0.5).stroke();
    }

    // ── Helper: label + value row ─────────────────────────────────────────────

    function metaRow(label: string, value: string) {
      const rowY = doc.y;
      doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280')
        .text(label, L, rowY, { width: 180, lineBreak: false });
      doc.fontSize(8.5).font('Helvetica').fillColor('#111827')
        .text(value, L + 190, rowY, { width: usableW - 190, lineBreak: false });
      doc.y = rowY + 16;
    }

    // ── Helper: section title ─────────────────────────────────────────────────

    function sectionTitle(text: string) {
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827')
        .text(text, L, doc.y, { width: usableW });
      doc.moveDown(0.3);
      rule();
      doc.moveDown(0.5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1 — COVER / SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    pageHeader();

    // Title block
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#111827')
      .text('Tax Strategy Summary', L, doc.y, { width: usableW });
    doc.moveDown(0.2);
    doc.fontSize(13).font('Helvetica').fillColor('#374151')
      .text(`Tax Year ${taxpayerSummary.taxYear}`, { width: usableW });
    doc.moveDown(1.2);

    // Prepared-for block
    doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280')
      .text(`Prepared for:      ${taxpayerSummary.email}`, L, doc.y, { width: usableW })
      .text(`Prepared using:  MoneyXprt — educational planning software`)
      .text(`Generated:          ${new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })}`);
    doc.moveDown(1.2);

    // Disclaimer box
    const disclaimerText =
      'DISCLAIMER: This document summarizes tax strategies the taxpayer has identified and ' +
      'self-reported as implemented or in progress. This is not tax advice. All strategies ' +
      'should be reviewed and verified by a qualified tax professional before filing. ' +
      'MoneyXprt is an educational tool and is not a substitute for professional tax preparation.';

    doc.fontSize(7.5).font('Helvetica');
    const dH = doc.heightOfString(disclaimerText, { width: usableW - 24 });
    const dY = doc.y;
    doc.rect(L, dY, usableW, dH + 16).fill('#f3f4f6');
    doc.fillColor('#374151')
      .text(disclaimerText, L + 12, dY + 8, { width: usableW - 24 });
    doc.y = dY + dH + 24;
    doc.moveDown(0.8);

    // Taxpayer summary
    sectionTitle('Taxpayer Summary');
    metaRow('Filing Status',                taxpayerSummary.filingStatus);
    metaRow('State',                        taxpayerSummary.state);
    metaRow('Tax Year',                     String(taxpayerSummary.taxYear));
    metaRow('Estimated Gross Income (AGI)', fmtCurrency(taxpayerSummary.estimatedAGI));
    doc.moveDown(1);

    // Financial baseline & freedom plan — surfaces the plan already generated on
    // Plan and the debt/tax figures already shown elsewhere, for the CPA's context.
    sectionTitle('Financial Baseline & Freedom Plan');
    metaRow('W-2 Income', fmtCurrency(financialBaseline.w2Income));
    metaRow(
      'Debt Payoff Horizon',
      financialBaseline.debtFreeYear != null ? String(financialBaseline.debtFreeYear) : 'No active debt-payoff plan',
    );
    metaRow(
      'Target Freedom Passive Income',
      financialBaseline.freedomNumberMonthly != null && financialBaseline.targetFreedomYear != null
        ? `${fmtCurrency(financialBaseline.freedomNumberMonthly)}/mo by ${financialBaseline.targetFreedomYear}`
        : 'No plan generated yet',
    );
    metaRow(
      'Current Estimated Tax Drag',
      `${(financialBaseline.effectiveTaxRate * 100).toFixed(1)}%  (${fmtCurrency(financialBaseline.taxPaidLastYear)} paid last year)`,
    );
    doc.moveDown(1);

    // Total savings banner
    if (totalEstimatedSavings > 0) {
      const bannerY = doc.y;
      doc.rect(L, bannerY, usableW, 48).fill('#1f2937');
      doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af')
        .text(
          'TOTAL ESTIMATED ANNUAL TAX SAVINGS (IMPLEMENTED STRATEGIES)',
          L + 14, bannerY + 9, { width: usableW - 28 },
        );
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff')
        .text(fmtCurrency(totalEstimatedSavings), L + 14, bannerY + 22, { width: usableW - 28 });
      doc.y = bannerY + 60;
      doc.moveDown(0.8);
    }

    // Strategy listing on cover — grouped by category
    if (implementedStrategies.length > 0) {
      sectionTitle(`Implemented Strategies (${implementedStrategies.length})`);
      for (const group of strategyGroups) {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280')
          .text(group.title.toUpperCase(), L, doc.y, { width: usableW, lineBreak: false });
        doc.moveDown(0.3);
        for (const s of group.strategies) {
          const rowY = doc.y;
          const label = s.ircSection ? `${s.name}  (${s.ircSection})` : s.name;
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
            .text(label, L, rowY, { width: usableW - 110, lineBreak: false });
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827')
            .text(fmtCurrency(s.estimatedAnnualValue) + '/yr', L + usableW - 100, rowY,
              { width: 100, align: 'right', lineBreak: false });
          doc.y = rowY + 15;
        }
        doc.moveDown(0.4);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGES 2+  — STRATEGY DETAIL
    // ─────────────────────────────────────────────────────────────────────────

    if (implementedStrategies.length > 0) {
      doc.addPage();
      pageHeader('Strategy Detail');

      for (const group of strategyGroups) {
        // Group header — check overflow so it never gets stranded alone at page bottom
        if (doc.y + 40 > doc.page.height - L) {
          doc.addPage();
          pageHeader('Strategy Detail (continued)');
        }
        doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#111827')
          .text(group.title, L, doc.y, { width: usableW, lineBreak: false });
        doc.moveDown(0.5);

        for (let i = 0; i < group.strategies.length; i++) {
          const s = group.strategies[i];

          // Pre-measure content height so we can check page overflow
          doc.fontSize(8.5).font('Helvetica');
          const descH = doc.heightOfString(s.description,            { width: usableW - 16 });
          const docH  = doc.heightOfString(s.documentationRequired,  { width: usableW - 16 });
          const neededH = 28 + 14 + descH + 16 + 14 + docH + (s.dateImplemented ? 30 : 0) + 24;

          if (doc.y + neededH > doc.page.height - L) {
            doc.addPage();
            pageHeader('Strategy Detail (continued)');
          }

          // Header bar
          const hY = doc.y;
          doc.rect(L, hY, usableW, 28).fill('#f3f4f6');
          const headerLabel = s.ircSection ? `${s.name}  (${s.ircSection})` : s.name;
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827')
            .text(headerLabel, L + 8, hY + 8, { width: usableW - 120, lineBreak: false });
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#374151')
            .text(fmtCurrency(s.estimatedAnnualValue) + '/yr', L + usableW - 112, hY + 8,
              { width: 112, align: 'right', lineBreak: false });
          doc.y = hY + 36;

          // Description
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280')
            .text('DESCRIPTION', L + 8, doc.y, { width: usableW - 16 });
          doc.moveDown(0.25);
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
            .text(s.description, L + 8, doc.y, { width: usableW - 16 });
          doc.moveDown(0.7);

          // Documentation required
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280')
            .text('DOCUMENTATION REQUIRED', L + 8, doc.y, { width: usableW - 16 });
          doc.moveDown(0.25);
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
            .text(s.documentationRequired, L + 8, doc.y, { width: usableW - 16 });
          doc.moveDown(0.7);

          // Date implemented
          if (s.dateImplemented) {
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280')
              .text('DATE IMPLEMENTED', L + 8, doc.y, { width: usableW - 16 });
            doc.moveDown(0.25);
            doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
              .text(s.dateImplemented, L + 8, doc.y, { width: usableW - 16 });
            doc.moveDown(0.7);
          }

          // Separator between strategies within the same group
          if (i < group.strategies.length - 1) {
            doc.moveDown(0.3);
            rule('#e5e7eb');
            doc.moveDown(0.8);
          }
        }

        doc.moveDown(1);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAST PAGE — REPS HOUR LOG
    // ─────────────────────────────────────────────────────────────────────────

    if (repsSummary.totalHoursLoggedYTD > 0) {
      doc.addPage();
      pageHeader('Real Estate Professional Status — Time Log');

      // Stats line
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
        .text(
          `Total hours logged: ${repsSummary.totalHoursLoggedYTD.toFixed(1)}` +
          `  ·  Requirement: 750+ hours and more than 50% of total working time`,
          L, doc.y, { width: usableW },
        );
      doc.moveDown(0.6);

      // Status pill
      const met = repsSummary.meetsRequirement;
      const statusText = met
        ? 'Requirement met (750+ hours logged)'
        : `Requirement not yet met — ${(750 - repsSummary.totalHoursLoggedYTD).toFixed(1)} hours remaining`;
      const statusBg  = met ? '#f0fdf4' : '#fef2f2';
      const statusFg  = met ? '#166534' : '#991b1b';
      const pillY     = doc.y;
      const pillH     = 22;
      doc.rect(L, pillY, usableW, pillH).fill(statusBg);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(statusFg)
        .text(statusText, L + 10, pillY + 6, { width: usableW - 20, lineBreak: false });
      doc.y = pillY + pillH + 16;

      // ── Monthly breakdown ─────────────────────────────────────────────────

      sectionTitle('Monthly Summary');

      const mW1 = 160; // month column
      const mW2 =  80; // hours column

      // Header row
      const mhY = doc.y;
      doc.rect(L, mhY, mW1 + mW2, 18).fill('#f3f4f6');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280');
      doc.text('MONTH', L + 6, mhY + 4, { width: mW1 - 6, lineBreak: false });
      doc.text('HOURS', L + mW1 + 6, mhY + 4, { width: mW2 - 6, lineBreak: false });
      doc.y = mhY + 20;

      for (const row of repsSummary.monthlyBreakdown) {
        const rY = doc.y;
        doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
        doc.text(row.month,              L + 6,       rY, { width: mW1 - 6, lineBreak: false });
        doc.text(row.hours.toFixed(1),   L + mW1 + 6, rY, { width: mW2 - 6, lineBreak: false });
        doc.y = rY + 14;
        doc.moveTo(L, doc.y).lineTo(L + mW1 + mW2, doc.y)
          .strokeColor('#f3f4f6').lineWidth(0.5).stroke();
      }

      doc.moveDown(1.2);

      // ── Activity log ──────────────────────────────────────────────────────

      sectionTitle('Activity Log');

      const aW = {
        date: 65,
        hrs:  42,
        desc: 210,
        cat:  usableW - 65 - 42 - 210, // remaining ≈ 151
      };

      function activityTableHeader() {
        const hY = doc.y;
        doc.rect(L, hY, usableW, 18).fill('#f3f4f6');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280');
        doc.text('DATE',         L + 4,                       hY + 4, { width: aW.date - 4, lineBreak: false });
        doc.text('HRS',          L + aW.date + 4,             hY + 4, { width: aW.hrs  - 4, lineBreak: false });
        doc.text('DESCRIPTION',  L + aW.date + aW.hrs + 4,   hY + 4, { width: aW.desc - 4, lineBreak: false });
        doc.text('IRS CATEGORY', L + aW.date + aW.hrs + aW.desc + 4, hY + 4, { width: aW.cat - 4, lineBreak: false });
        doc.y = hY + 20;
      }

      activityTableHeader();

      for (let i = 0; i < repsSummary.activityLog.length; i++) {
        const log = repsSummary.activityLog[i];

        // Measure row height from tallest cell
        doc.fontSize(7.5).font('Helvetica');
        const dH = doc.heightOfString(log.description, { width: aW.desc - 8 });
        const cH = doc.heightOfString(log.category,    { width: aW.cat  - 8 });
        const rH = Math.max(dH, cH, 12) + 8;

        // Page overflow — add new page and re-draw header
        if (doc.y + rH > doc.page.height - L - 60) {
          doc.addPage();
          doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af')
            .text('MoneyXprt  ·  REPS Log (continued)', L, L);
          doc.moveTo(L, L + 14).lineTo(W - L, L + 14)
            .strokeColor('#d1d5db').lineWidth(0.5).stroke();
          doc.y = L + 24;
          activityTableHeader();
        }

        const rY = doc.y;
        const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(L, rY, usableW, rH).fill(bg);

        doc.fontSize(7.5).font('Helvetica').fillColor('#374151');
        doc.text(log.date,                    L + 4,                     rY + 4, { width: aW.date - 8, lineBreak: false });
        doc.text(log.hours.toFixed(1),        L + aW.date + 4,           rY + 4, { width: aW.hrs  - 8, lineBreak: false });
        doc.text(log.description,             L + aW.date + aW.hrs + 4,  rY + 4, { width: aW.desc - 8 });
        doc.text(log.category, L + aW.date + aW.hrs + aW.desc + 4, rY + 4, { width: aW.cat - 8 });

        doc.y = rY + rH;
      }

      // Footer note
      doc.moveDown(1.5);
      rule('#d1d5db');
      doc.moveDown(0.5);
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#6b7280')
        .text(
          "This log was maintained contemporaneously via MoneyXprt's time tracking feature. " +
          'Per IRC §469(c)(7) and Treas. Reg. §1.469-5T(f)(4), reconstructed records prepared ' +
          'after the fact are generally not accepted as evidence of material participation.',
          L, doc.y, { width: usableW },
        );
    }

    doc.end();
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = await checkServerRateLimit(
      `cpa-report:${user.id}`,
      { maxRequests: 10, windowMs: 60 * 60 * 1_000 },
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many report requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    // ── Data + PDF ────────────────────────────────────────────────────────────
    const reportData = await buildCpaReportData(user.id, user.email ?? '');
    const pdfBuffer  = await generatePDF(reportData);

    const filename = `cpa-report-${reportData.taxpayerSummary.taxYear}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[generate-cpa-report]', err);
    return NextResponse.json({ error: 'Could not generate your CPA report. Please try again.' }, { status: 500 });
  }
}
