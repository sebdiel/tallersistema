$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Seccion_2_TallerPro.md'
$output = Join-Path $PSScriptRoot 'Seccion_2_TallerPro.docx'
$build = Join-Path $PSScriptRoot '.section2_docx_build'
if (Test-Path -LiteralPath $build) { throw "Build directory already exists: $build" }
New-Item -ItemType Directory -Path (Join-Path $build '_rels') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $build 'word\_rels') -Force | Out-Null

function XmlEscape([string]$text) { return [System.Security.SecurityElement]::Escape($text) }
function Paragraph([string]$text, [string]$style = 'Normal') {
  $escaped = XmlEscape $text
  if ($style -eq 'PageBreak') { return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' }
  $pPr = if ($style -eq 'Normal') { '<w:pPr><w:jc w:val="both"/><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr>' } else { '<w:pPr><w:pStyle w:val="' + $style + '"/></w:pPr>' }
  return '<w:p>' + $pPr + '<w:r><w:t xml:space="preserve">' + $escaped + '</w:t></w:r></w:p>'
}

$body = [System.Collections.Generic.List[string]]::new()
$lines = Get-Content -LiteralPath $source -Encoding UTF8
$sectionStarted = $false
foreach ($line in $lines) {
  $t = $line.Trim()
  if (-not $t) { continue }
  if ($t -eq '---') { continue }
  if ($t -eq '# 2. DESARROLLO DE LA SOLUCIÓN') {
    $body.Add((Paragraph '' 'PageBreak'))
    $body.Add((Paragraph '2. DESARROLLO DE LA SOLUCIÓN' 'Heading1'))
    $sectionStarted = $true
    continue
  }
  if ($t.StartsWith('# ')) { $body.Add((Paragraph $t.Substring(2) 'Title')); continue }
  if ($t.StartsWith('## ')) { $body.Add((Paragraph $t.Substring(3) 'Heading1')); continue }
  if ($t.StartsWith('### ')) { $body.Add((Paragraph $t.Substring(4) 'Heading2')); continue }
  $body.Add((Paragraph $t 'Normal'))
}

$section = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1984" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
$document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + ($body -join '') + $section + '</w:body></w:document>'
$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
 <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
 <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
 <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240" w:line="360" w:lineRule="auto"/></w:pPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:pPr><w:jc w:val="center"/><w:spacing w:before="360" w:after="240" w:line="360" w:lineRule="auto"/><w:outlineLvl w:val="0"/></w:pPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:pPr><w:jc w:val="left"/><w:spacing w:before="240" w:after="160" w:line="360" w:lineRule="auto"/><w:outlineLvl w:val="1"/></w:pPr></w:style>
</w:styles>
'@
$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>
'@
$rootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>
'@
$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $build '[Content_Types].xml'), $contentTypes, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $build '_rels\.rels'), $rootRels, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $build 'word\document.xml'), $document, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $build 'word\styles.xml'), $styles, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $build 'word\_rels\document.xml.rels'), $docRels, [System.Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $output) { throw "Output already exists: $output" }
[System.IO.Compression.ZipFile]::CreateFromDirectory($build, $output)
Write-Output "Created $output"
