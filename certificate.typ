// Neudata certificate of completion
// Values come from the command line (see make_certificates.py / make_certificates.R):
//   quarto typst compile certificate.typ out.pdf --input name="Jane Doe" --input course="..."
// Every value has a sample default so the file also compiles on its own.

#let input(key, default) = sys.inputs.at(key, default: default)

#let name         = input("name", "Participant Name")
#let course       = input("course", "Clinical Data Analysis in R — Phase I")
#let kind         = input("kind", "Certificate of Completion")
#let details      = input("details", "5 online sessions · 7.5 contact hours")
#let dates        = input("dates", "8 September – 6 October 2026")
#let location     = input("location", "Online")
#let issued       = input("issued", "06-10-2026")
#let cert-id      = input("id", "NDC-TR-2026-001")
#let sign1-name   = input("sign1_name", "Signatory Name")
#let sign1-title  = input("sign1_title", "Lead Trainer, Senior Biostatistician")
#let sign2-name   = input("sign2_name", "Signatory Name")
#let sign2-title  = input("sign2_title", "Trainer, Biostatistician")

// Long names shrink so they stay on one or two lines
#let name-length = name.clusters().len()
#let name-size = if name-length > 44 { 22pt } else if name-length > 32 { 27pt } else { 34pt }

#let teal  = rgb("#055F56")
#let navy  = rgb("#04242F")
#let blue  = rgb("#0B376C")
#let mist  = rgb("#EAF2F5")
#let grey  = rgb("#8A99A3")
#let seafoam = rgb("#9FD3CB")

#set page(paper: "a4", flipped: true, margin: 0pt)
#set text(font: ("Century Gothic", "Segoe UI", "Arial", "DejaVu Sans"), fill: navy)

// ---- Frame -------------------------------------------------------------------
#place(top + left, rect(width: 100%, height: 100%, fill: white))
#place(top + left, dx: 0.9cm, dy: 0.9cm,
  rect(width: 100% - 1.8cm, height: 100% - 1.8cm, stroke: 2.5pt + teal, radius: 4pt))
#place(top + left, dx: 1.2cm, dy: 1.2cm,
  rect(width: 100% - 2.4cm, height: 100% - 2.4cm, stroke: 0.6pt + seafoam, radius: 3pt))
// Corner arcs echoing the logo
#place(top + left, dx: -3.2cm, dy: -3.2cm, circle(radius: 4.2cm, stroke: 6pt + teal.transparentize(85%)))
#place(bottom + right, dx: 3.2cm, dy: 3.2cm, circle(radius: 4.2cm, stroke: 6pt + blue.transparentize(85%)))

// ---- Content -------------------------------------------------------------------
#place(top + center, dy: 1.9cm, image("assets/neudata-logo.png", height: 3.1cm))

#place(top + center, dy: 5.4cm, block(width: 22cm, align(center, stack(
  dir: ttb,
  text(size: 26pt, weight: "bold", tracking: 0.08em, fill: teal)[#upper(kind)],
  v(0.45cm),
  line(length: 6cm, stroke: 1.2pt + teal),
  v(0.9cm),
  text(size: 13pt, fill: grey)[This is to certify that],
  v(0.6cm),
  text(size: name-size, weight: "bold", fill: navy)[#name],
  v(0.6cm),
  text(size: 13pt, fill: grey)[has successfully completed],
  v(0.55cm),
  text(size: 20pt, weight: "bold", fill: blue)[#course],
  v(0.5cm),
  text(size: 11.5pt, fill: navy)[#details  ·  #dates  ·  #location],
))))

// ---- Signatures -----------------------------------------------------------------
#let signature(n, t) = block(width: 6.6cm)[
  #set align(center)
  #line(length: 100%, stroke: 0.7pt + navy)
  #v(0.12cm)
  #text(size: 11pt, weight: "bold")[#n] \
  #text(size: 9pt, fill: grey)[#t]
]

#place(bottom + center, dy: -3.1cm, block(width: 23cm)[
  #grid(
    columns: (6.6cm, 1fr, 6.6cm),
    column-gutter: 1cm,
    align: (left + bottom, center + bottom, right + bottom),
    signature(sign1-name, sign1-title),
    [
      #text(size: 9pt, fill: grey)[Issued] \
      #text(size: 11pt, weight: "bold")[#issued]
    ],
    signature(sign2-name, sign2-title),
  )
])

// ---- Footer ---------------------------------------------------------------------
#place(bottom + center, dy: -1.7cm, block(width: 24cm)[
  #set align(center)
  #text(size: 8.5pt, fill: grey)[
    Certificate ID: #text(fill: navy, weight: "bold")[#cert-id]  ·
    Verify at contact\@neu-data.com  ·
    Neudata Consulting Ltd  ·  www.neu-data.com
  ]
  #v(0.08cm)
  #text(size: 8.5pt, style: "italic", fill: teal)[Insight. Impact. Innovation.]
])
