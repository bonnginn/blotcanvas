#!/bin/zsh
set -euo pipefail

out_dir="${1:-public/demo}"
mkdir -p "$out_dir"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

font="/System/Library/Fonts/Supplemental/Arial.ttf"
ink="#17201f"
green="#174b43"
accent="#e86148"
paper="#eef2ef"
line="#c7d2ce"

base=(
  -size 1200x675 "xc:$paper"
  -fill white -stroke "$line" -strokewidth 2
  -draw "roundrectangle 42,34 1158,641 22,22"
  -fill "$green" -stroke none -draw "roundrectangle 42,34 1158,112 22,22"
  -fill white -font "$font" -pointsize 36 -gravity northwest -annotate +78+54 "BlotCanvas"
  -fill "#dcebe6" -pointsize 19 -annotate +302+65 "Western blot figure preparation"
)

magick "${base[@]}" \
  -fill "$ink" -pointsize 30 -annotate +92+154 "1  Import image sets" \
  -fill "#f7faf8" -stroke "$line" -draw "roundrectangle 92,210 1108,548 14,14" \
  -fill "$green" -stroke none -draw "roundrectangle 126,248 344,308 10,10" \
  -fill white -pointsize 22 -annotate +164+266 "Select folder" \
  -fill "$ink" -pointsize 21 -annotate +410+245 "Signal" -annotate +652+245 "Merge" -annotate +894+245 "Marker" \
  -fill white -stroke "#9fb3ac" -draw "roundrectangle 388,282 584,456 10,10 roundrectangle 628,282 824,456 10,10 roundrectangle 868,282 1064,456 10,10" \
  -fill "#6d7774" -stroke none \
  -draw "rectangle 420,344 550,354 rectangle 420,386 550,396 rectangle 660,344 790,354 rectangle 660,386 790,396 rectangle 900,324 940,334 rectangle 900,366 940,376 rectangle 900,408 940,418" \
  -fill "$green" -pointsize 20 -annotate +92+585 "Images stay in your browser" \
  "$tmp_dir/01.png"

magick "${base[@]}" \
  -fill "$ink" -pointsize 30 -annotate +92+154 "2  Define each blot region" \
  -fill "#e5e9e7" -stroke "#9fb0aa" -draw "roundrectangle 116,210 1084,548 12,12" \
  -fill "#303735" -stroke none \
  -draw "roundrectangle 260,288 326,300 6,6 roundrectangle 382,284 448,300 6,6 roundrectangle 504,290 570,302 6,6 roundrectangle 626,282 692,301 6,6 roundrectangle 748,288 814,301 6,6 roundrectangle 870,284 936,300 6,6" \
  -fill "#303735" -draw "roundrectangle 260,438 326,452 7,7 roundrectangle 382,438 448,452 7,7 roundrectangle 504,438 570,452 7,7 roundrectangle 626,438 692,452 7,7 roundrectangle 748,438 814,452 7,7 roundrectangle 870,438 936,452 7,7" \
  -fill none -stroke "$accent" -strokewidth 4 \
  -draw "rectangle 220,255 974,332 rectangle 220,408 974,480" \
  -fill "$accent" -stroke none -pointsize 19 -annotate +232+224 "Target protein" -annotate +232+377 "Loading control" \
  -fill "$green" -pointsize 20 -annotate +92+585 "Shared width, independently adjustable height" \
  "$tmp_dir/02.png"

magick "${base[@]}" \
  -fill "$ink" -pointsize 30 -annotate +92+154 "3  Place molecular-weight markers" \
  -fill "#f7f8f7" -stroke "$ink" -strokewidth 2 -draw "rectangle 188,235 938,488" \
  -fill "#222" -stroke none \
  -draw "roundrectangle 280,348 348,362 7,7 roundrectangle 390,344 458,362 7,7 roundrectangle 500,350 568,362 7,7 roundrectangle 610,341 678,362 7,7 roundrectangle 720,347 788,362 7,7 roundrectangle 830,343 898,362 7,7" \
  -stroke "$ink" -strokewidth 3 -draw "line 938,282 958,282 line 938,354 958,354 line 938,430 958,430" \
  -fill "$ink" -stroke none -pointsize 22 -annotate +976+267 "75" -annotate +976+339 "50" -annotate +976+415 "25" \
  -fill "$green" -pointsize 18 -annotate +982+216 "(kD)" \
  -fill "$green" -pointsize 20 -annotate +92+585 "Marker positions remain tied to the original image" \
  "$tmp_dir/03.png"

magick "${base[@]}" \
  -fill "$ink" -pointsize 30 -annotate +92+154 "4  Add lane conditions" \
  -fill "$ink" -pointsize 20 -annotate +128+234 "Treatment" -annotate +154+294 "Drug" \
  -gravity northwest -annotate +352+222 "Control" -annotate +744+222 "Drug A" \
  -stroke "$ink" -strokewidth 2 -draw "line 250,258 570,258 line 642,258 962,258" \
  -fill "$ink" -stroke none -pointsize 22 \
  -annotate +286+278 "-" -annotate +390+278 "+" -annotate +494+278 "-" -annotate +598+278 "+" -annotate +702+278 "-" -annotate +806+278 "+" -annotate +910+278 "-" \
  -fill "#fafafa" -stroke "$ink" -strokewidth 2 -draw "rectangle 246,340 974,468" \
  -fill "#222" -stroke none \
  -draw "roundrectangle 270,392 330,405 7,7 roundrectangle 358,387 418,405 7,7 roundrectangle 446,393 506,405 7,7 roundrectangle 534,383 594,405 7,7 roundrectangle 622,390 682,405 7,7 roundrectangle 710,385 770,405 7,7 roundrectangle 798,392 858,405 7,7 roundrectangle 886,382 946,405 7,7" \
  -fill "$ink" -pointsize 22 -annotate +96+390 "Target protein" \
  -fill "$green" -pointsize 20 -annotate +92+585 "Labels stay editable in the exported PDF" \
  "$tmp_dir/04.png"

magick "${base[@]}" \
  -fill "$ink" -pointsize 30 -annotate +92+154 "5  Export and continue editing" \
  -fill white -stroke "$line" -strokewidth 2 \
  -draw "roundrectangle 110,228 402,500 14,14 roundrectangle 454,228 746,500 14,14 roundrectangle 798,228 1090,500 14,14" \
  -fill "$accent" -stroke none -draw "roundrectangle 154,278 358,340 10,10" \
  -fill white -pointsize 25 -annotate +204+296 "Editable PDF" \
  -fill "$green" -pointsize 23 -annotate +534+296 "PNG / TIFF" -annotate +871+296 "Project JSON" \
  -fill "$ink" -pointsize 18 -annotate +148+382 "Text, lines and frames" -annotate +501+382 "Ready-to-share image" -annotate +846+382 "Resume the workflow" \
  -fill "$green" -pointsize 22 -annotate +92+573 "From raw images to an editable figure — locally in your browser" \
  "$tmp_dir/05.png"

magick "$tmp_dir/05.png" -quality 92 "$out_dir/blotcanvas-og.png"
magick -delay 150 \
  "$tmp_dir/01.png" \
  "$tmp_dir/02.png" \
  "$tmp_dir/03.png" \
  "$tmp_dir/04.png" \
  "$tmp_dir/05.png" \
  -loop 0 "$out_dir/blotcanvas-demo.gif"
