export function downloadFile(filename: string, content: string, mime = 'text/html') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// Printable prototype invoice (open → Print → Save as PDF).
export function invoiceDocument(o: {
  number: string; title: string; issueDate: string; dueDate: string; billedTo: string; address?: string
  lines: { description: string; qty: number; rate: number; taxRate: number }[]
  subtotal: number; tax: number; total: number; paid: number; due: number; credit?: number; status: string
}) {
  const money = (n: number) => '₹' + n.toLocaleString('en-IN')
  const rows = o.lines.map(l => `<tr><td>${esc(l.description)}</td><td>${l.qty}</td><td>${money(l.rate)}</td><td>${l.taxRate ? Math.round(l.taxRate * 100) + '%' : 'Exempt / at actuals'}</td><td>${money(l.qty * l.rate)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.number)}</title>
<style>body{font-family:system-ui,-apple-system,Roboto,"Noto Sans",sans-serif;color:#1b1f1c;max-width:760px;margin:40px auto;padding:0 24px}
h1{font-family:serif;font-weight:400;letter-spacing:.12em}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:14px}
.r{text-align:right}.wm{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:64px;color:rgba(200,166,93,.15);transform:rotate(-20deg);pointer-events:none}
.note{font-size:12px;color:#666;border:1px dashed #bbb;padding:10px}</style></head><body>
<div class="wm">PROTOTYPE — NOT A TAX INVOICE</div>
<h1>EZIT ELITE</h1><p>Membership &amp; Concierge</p>
<p><strong>Invoice ${esc(o.number)}</strong><br>${esc(o.title)}<br>Issued ${esc(o.issueDate)} · Due ${esc(o.dueDate)} · Status: ${esc(o.status)}</p>
<p>Billed to: ${esc(o.billedTo)}${o.address ? '<br>' + esc(o.address) : ''}</p>
<table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<p class="r">Subtotal ${money(o.subtotal)}<br>GST ${money(o.tax)}<br><strong>Total ${money(o.total)}</strong><br>Paid ${money(o.paid)}${o.credit ? `<br>Credit applied ${money(o.credit)}` : ''}<br><strong>Amount due ${money(o.due)}</strong></p>
<p class="note">Prototype document generated in the browser from fictional demo data. Invoice numbering, GST applicability, place of supply and foreign billing must be validated by finance advisers before production use.</p>
</body></html>`
}
