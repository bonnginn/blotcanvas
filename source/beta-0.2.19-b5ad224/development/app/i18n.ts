"use client";

import { useEffect } from "react";

const EN: Record<string, string> = {
  "ベータ版": "Beta",
  "はじめての方へ": "Getting started",
  "アプリとして追加": "Install app",
  "開く": "Open",
  "保存": "Save",
  "プロジェクト名・保存名": "Project and file name",
  "プロジェクト名／保存ファイル名": "Project / output file name",
  "JSON・Figure・Source recordの共通ファイル名になります":
    "Used as the shared file name for JSON, Figure, and Source record outputs",
  "未変更の場合、撮影フォルダ選択時にフォルダ名を自動入力します":
    "If unchanged, the selected acquisition folder name is entered automatically",
  "例：2026-08-17_AurA_WB": "e.g. 2026-08-17_protein_WB",
  "端末内処理": "Local processing",
  "説明：標準": "Details: standard",
  "説明：コンパクト": "Details: compact",
  "説明表示": "Guidance",
  "詳細": "Detailed",
  "コンパクト": "Compact",
  "説明表示：詳細": "Guidance: detailed",
  "説明表示：コンパクト": "Guidance: compact",
  "補足説明の表示量を切り替えます":
    "Change the amount of explanatory text shown",
  "選択した画像・プロジェクトはサーバーへ送信されません":
    "Selected images and projects are not uploaded to a server",
  "実装予定": "Planned",
  "レーンプロファイル・ピーク積分": "Lane profiles and peak integration",
  "推奨ブラウザ": "Recommended browsers",
  "最新版 Chrome / Edge": "Latest Chrome / Edge",
  "データの取り扱い": "Data handling",
  "TIFFの読み込み、画像調整、Figure作成はこのブラウザ内で行います。元画像をBlotCanvasのサーバーへ保存・送信する機能はありません。プロジェクトJSONは画像本体を含まず、再開時に元画像フォルダを選んで再リンクします。公開版では、利用状況を把握するためCloudflare Web AnalyticsによるCookieを使わない匿名のページビュー統計を取得します。画像、プロジェクト内容、入力した条件は統計へ送信されません。出力ファイルはブラウザのダウンロード先へ保存されます。最新版のGoogle ChromeまたはMicrosoft Edgeを推奨します。Safariなどではファイル・フォルダ操作の挙動が異なる場合があります。":
    "TIFF import, image adjustment, and Figure preparation run locally in this browser. BlotCanvas does not upload or store original images on its server. Project JSON files do not embed image data; choose the source-image folder to relink when resuming. The public site uses cookie-free Cloudflare Web Analytics to collect anonymous page-view statistics. Images, project contents, and entered experimental conditions are not included in analytics. Output files are saved to the browser’s download destination. The latest Google Chrome or Microsoft Edge is recommended. File and folder operations may behave differently in Safari and other browsers.",
  "不具合・改善を報告": "Report a problem or suggestion",
  "撮影セット": "Image sets",
  "水平補正": "Rotation",
  "領域指定": "Crop regions",
  "Figure用輝度調整": "Figure display adjustment",
  "マーカー": "Molecular-weight markers",
  "条件表": "Lane labels",
  "構成・出力": "Layout and export",
  "定量化": "Quantification",
  "グラフ": "Graphs",
  "撮影ファイルをまとめる": "Organize acquisition files",
  "撮影セットプレビュー": "Image-set preview",
  "撮影セットを画像で確認": "Review image sets visually",
  "自由表エディタ（セル結合対応）":
    "Free-form table editor (supports merged cells)",
  "Figureを見ながらラベル表を編集":
    "Edit the label table while viewing the figure",
  "テンプレートで作る": "Build from a template",
  "よく使う条件から下書きを生成":
    "Generate a draft from common condition patterns",
  "自由編集": "Free-form editing",
  "Excel型の表でセル結合まで編集":
    "Edit and merge cells in a spreadsheet-style table",
  "表を編集": "Edit table",
  "右側の「表を編集」を使用します": "Use Edit table on the right",
  "セル入力、結合・解除、条件行の追加・削除・並べ替えを広い画面で行えます。":
    "Use the full-width workspace to edit cells, merge or unmerge them, and add, remove, or reorder condition rows.",
  "抗体名、条件ラベル、セル結合をここで調整できます":
    "Edit antibody names, condition labels, and merged cells here",
  "下書き後の文字編集・セル結合・行の並べ替えは、右側のFigureプレビューで行います。":
    "After creating a draft, edit text, merge cells, and reorder rows in the Figure preview on the right.",
  "下書き後に自由編集へ切り替えると、右側のExcel型エディタで調整できます。":
    "After creating a draft, switch to Free-form editing and refine it in the spreadsheet-style editor on the right.",
  "セルをクリック、Shift＋クリックで範囲選択":
    "Click a cell, then Shift-click another to select a range",
  "条件名": "Condition",
  "ドラッグして行を並べ替え": "Drag to reorder rows",
  "つかんで並べ替え": "Drag to reorder",
  "1つ上へ移動": "Move up one row",
  "1つ下へ移動": "Move down one row",
  "Figureに表示中": "Shown in Figure",
  "Figureでは非表示": "Hidden from Figure",
  "Figureに表示": "Show in Figure",
  "セル結合": "Merge cells",
  "結合解除": "Unmerge",
  "右へオートフィル": "Autofill right",
  "同一値を結合": "Merge identical values",
  "group線 切替": "Toggle group line",
  "区切り線": "Separator line",
  "＋ 条件行を追加": "+ Add condition row",
  "選択セルを結合": "Merge selected cells",
  "結合を解除": "Unmerge cells",
  "結合セルの下に区切り線を表示":
    "Show a separator line below merged cells",
  "撮影とゲルの対応": "Match image sets to gels",
  "同じ撮影内に複数ゲルがあるか、ゲルごとに別撮影かを選びます。":
    "Choose whether each image contains multiple gels or each gel was imaged separately.",
  "各撮影に全ゲルが写っている": "Every image contains all gels",
  "撮影順に1撮影＝1ゲル": "One image per gel, in order",
  "個別の例外は、下の各画像にあるGelチェックで修正できます。":
    "Use the gel checkboxes on each image below to handle exceptions.",
  "この撮影に含まれるゲル": "Gels included in this image",
  "Mergeを優先表示します。画像ごとにCL・Merge・Mを切り替えられます。":
    "Merge is shown by default. Switch between CL, Merge, and M for each image set.",
  "抗体名未入力": "Antibody name not entered",
  "このセットを除外": "Exclude this image set",
  "ここでは撮影セットの採否とゲル数を確認します。各ゲルの正確な範囲はStep 3「領域指定」で設定します。":
    "Use this screen to choose image sets and the number of gels. Define the exact gel regions in Step 3, Crop regions.",
  "撮影装置を選ぶと、装置に合った取り込み方法を表示します。":
    "Choose an imaging system to display the appropriate import workflow.",
  "ATTO LuminoGraph": "ATTO LuminoGraph",
  "CL・Merge・Mを自動分類": "Automatically classify CL, Merge, and M files",
  "その他の撮影装置": "Other imaging systems",
  "画像の役割を手動で選択": "Assign image roles manually",
  "＋ 撮影フォルダを選択": "+ Select acquisition folder",
  "ファイルを個別選択": "Select files individually",
  "前回の設定を再利用": "Reuse previous settings",
  "設定テンプレートJSONを読み込む": "Load settings template JSON",
  "日付_000X_CL／Mergeと000(X+1)_M、およびSum撮影の組み合わせを自動でまとめ、撮影番号順に並べます。露光設定用TIFFは無視します。":
    "Automatically groups date_000X_CL/Merge with 000(X+1)_M, including Sum acquisitions, and sorts the sets by acquisition number. TIFF files used only to set exposure are ignored.",
  "条件表、レーン数、文字設定、登録マーカーを読み込みます。撮影ごとに変わる水平補正、切り出し枠、輝度、マーカー位置は読み込みません。":
    "Loads lane labels, lane count, typography, and marker presets. Rotation, crop regions, display adjustment, and marker positions are acquisition-specific and are not reused.",
  "読み込んだファイルを整理・除外": "Review or exclude imported files",
  "撮影ごと": "Per image set",
  "全撮影をここでまとめて確認・修正できます。":
    "Review and edit all image sets here.",
  "全体画像上で、選択した分子量のバンド位置をクリック":
    "Click the selected molecular-weight band on the full image",
  "ゲル／最終パネル": "Gels / final panels",
  "＋ ゲルを追加": "+ Add gel",
  "Merge作業画面": "Merge workspace",
  "まず撮影ファイルを読み込みます": "Import acquisition files first",
  "撮影装置を選び、画像ファイルまたは撮影フォルダを読み込んでください。":
    "Choose an imaging system, then import image files or an acquisition folder.",
  "ゲルごとに水平線で合わせる": "Align each gel with a horizontal guide",
  "撮影×ゲルごとに、基準にするマーカーバンドを1点クリックします。その位置へ水平線が移動するので、右側の角度スライダーでバンドと線を平行にしてください。":
    "For each image set and gel, click one reference marker band, then adjust the angle until the band is parallel to the horizontal guide.",
  "各カードで個別調整": "Adjust each card independently",
  "ブロットごとの高さを決める": "Define each blot region",
  "横幅は割り当てたゲル内だけ、高さは同じ抗体の領域だけ同期します。位置は各枠で独立です。":
    "Width is synchronized within each gel; height is synchronized only for regions using the same antibody. Position remains independent.",
  "＋ 選択中の撮影に領域を追加": "+ Add region to selected image set",
  "抗体名（候補から選択／直接入力）": "Antibody (select a suggestion or type)",
  "回転変更後：枠・マーカー位置を確認してください":
    "Rotation changed: review the crop and marker positions",
  "ゲル／パネル": "Gel / panel",
  "抗体（撮影セットの候補）": "Antibody (from image-set list)",
  "選択してください": "Select",
  "抗体名（直接編集も可能）": "Antibody name (editable)",
  "共通横幅": "shared width",
  "共通高さ": "shared height",
  "メンブレンの水平微調整": "Fine rotation adjustment",
  "Figure表示は元画素値のMin / Maxを直線変換します。Autoは選択枠の分布を解析し、同じ抗体名・同じbit深度へ共有します。":
    "Figure display uses a linear Min/Max mapping in source-pixel units. Auto analyzes the selected crop and shares the range with the exact same antibody name and bit depth.",
  "この切出し領域をAuto": "Auto this crop",
  "解析中…": "Analyzing…",
  "同じ抗体名・bit深度と調整を共有":
    "Share with the same antibody name and bit depth",
  "階調情報・クリップ率": "Tone range and clipping",
  "旧方式の輝度設定を維持中 · AutoまたはMin / Max操作で新方式へ変換":
    "Legacy display settings are preserved · use Auto or Min/Max to convert",
  "このGelの分子量表示": "Molecular-weight display for this gel",
  "マーカーを設定する": "Configure markers",
  "このFigureではマーカーを表示しない": "Do not show markers in this Figure",
  "未確認": "Unconfirmed",
  "Excelと同じ感覚で条件を入力します。複数セルのコピー＆ペースト、範囲選択、セル結合に対応しています。":
    "Enter conditions in a spreadsheet-style grid with multi-cell copy/paste, range selection, and merged cells.",
  "元に戻す": "Undo",
  "やり直す": "Redo",
  "Gel 1の表を他の全Gelへコピー": "Copy Gel 1 table to all other gels",
  "未入力": "Not set",
  "選択パターンを右へオートフィル": "Autofill selection to the right",
  "↔ 同じゲルの横幅を同期": "↔ Synchronize width for the same gel",
  "この画像を選択": "Select this image",
  "領域を移動": "Move region",
  "左": "Left",
  "上": "Top",
  "この領域を削除": "Delete this region",
  "Figure用画像の見え方を整える": "Adjust Figure appearance",
  "Figure用画像プレビュー": "Figure image preview",
  "白黒反転": "Invert",
  "明るさ": "Brightness",
  "コントラスト": "Contrast",
  "自動": "Auto",
  "Autoは選択した切出し枠を解析し、同じ抗体の全ブロットへ同じ階調・明るさ・コントラストを適用します。":
    "Auto analyzes the selected crop and applies the same levels, brightness, and contrast to all blots using the same antibody.",
  "◐ この切出し領域をAuto": "◐ Auto-adjust this crop",
  "領域Auto": "Auto-adjust region",
  "分子量マーカーを指定": "Set molecular-weight markers",
  "マーカー製品": "Marker product",
  "最近使用": "Recently used",
  "このブロットシリーズでは同じ分子量を利用する":
    "Use the same molecular weights throughout this blot series",
  "配置をリセット": "Reset placement",
  "マーカー種類": "Marker type",
  "赤枠ごとに表示する分子量を複数選び、M全体画像を上から順にクリックします。選んだ分子量が大きい順に配置されます。":
    "For each red region, select the molecular weights to display and click their bands on the full M image from top to bottom.",
  "種類を選ぶと分子量一覧へすぐ反映されます。選んだ種類と自作プリセットはこのブラウザに保存され、プロジェクトJSONにも含まれます。":
    "Choosing a marker type immediately updates the molecular-weight list. The selection and custom presets are stored in this browser and included in the project JSON.",
  "このブロットシリーズで選択を共通化":
    "Use the same molecular-weight selection for this blot series",
  "選択中の種類を再適用": "Reapply selected marker type",
  "新しいマーカーパターンを登録して適用しました":
    "Registered and applied the new marker preset",
  "＋ 手持ちのマーカーを新規登録": "+ Register a custom marker",
  "このメンブレンの配置をリセット": "Reset placement for this membrane",
  "新しいマーカーパターンを登録": "Register a new marker preset",
  "レーン条件を作る": "Create lane labels",
  "条件JSONを読み込む": "Load lane-label JSON",
  "完成形に近い方式を選んで下書きを作り、その後で名称や各レーンを自由に修正します。設定内容は右側のFigure previewへ即時反映されます。":
    "Choose the closest template, then freely edit row names and lane labels. Changes appear immediately in the Figure preview.",
  "設定テンプレートを保存": "Save settings template",
  "設定テンプレートを読込": "Load settings template",
  "レーン数（数字を直接入力）": "Number of lanes (enter a number)",
  "レーンラベルの位置": "Lane-label position",
  "Figure previewを見ながら画像のレーンへ合わせます":
    "Align labels to lanes while viewing the Figure preview",
  "ラベル列の中心": "Label-column center",
  "通常は50%のままで構いません": "Usually leave this at 50%",
  "ラベル列全体の幅": "Total label-column width",
  "切り出し画像の幅に合わない場合だけ調整します":
    "Adjust only when labels do not align with the cropped image",
  "条件の並び方を選ぶ": "Choose a label structure",
  "選択後も、生成された表はすべて編集できます":
    "The generated table remains fully editable",
  "各レーンに個別ラベル": "Individual label for every lane",
  "繰り返しや階層のない単純な並び": "Simple layout without repetition or hierarchy",
  "各グループ内で同じ条件を繰り返す":
    "Repeat the same subconditions within each group",
  "上段のグループ名（カンマ区切り）":
    "Upper-level group names (comma-separated)",
  "各グループで繰り返す条件（2つ）":
    "Two conditions repeated within each group",
  "上段の項目名": "Upper row label",
  "下段の項目名": "Lower row label",
  "この方式で下書きを作る": "Create table from this template",
  "一部のレーンを共通名でまとめる":
    "Group selected lanes under a shared label",
  "上位ラベルのない対照群と、1つ以上の標的グループを組み合わせられます。":
    "Combine an unlabeled control lane with one or more target groups.",
  "上段の標的名（複数の場合はカンマ区切り）":
    "Upper target names (comma-separated)",
  "ネガティブコントロール名": "Negative-control label",
  "配列名（カンマ区切り）": "Sequence labels (comma-separated)",
  "上段グループ（空欄なら文字と横線を表示しません）":
    "Upper groups (leave blank to hide both label and line)",
  "上段ラベル（空欄可）": "Upper label (optional)",
  "開始": "Start",
  "幅": "Width / span",
  "＋ 上段グループを追加": "+ Add upper group",
  "このグループを削除": "Delete this group",
  "交互条件を追加": "Add alternating condition",
  "薬剤、光、刺激などの − / ＋ を交互に配置":
    "Alternate − / + for drug, light, stimulation, etc.",
  "− / ＋ 行を追加": "Add − / + row",
  "詳細な条件表を開く": "Open detailed lane-label table",
  "レーン数": "Number of lanes",
  "ラベル位置の微調整": "Fine-tune label positions",
  "単純ラベル": "Simple labels",
  "繰り返し条件": "Repeated conditions",
  "階層条件": "Hierarchical conditions",
  "±条件": "+/− conditions",
  "項目名": "Row label",
  "この条件行を削除": "Delete this condition row",
  "条件行を追加": "Add condition row",
  "順番を決めて書き出す": "Arrange and export",
  "ゲルごとに別パネルとして出力します。横幅はゲル単位、高さは抗体単位で揃います。":
    "Each gel is exported as a separate panel. Width is synchronized by gel and height by antibody.",
  "フォント": "Font",
  "文字サイズ（px）": "Font size (px)",
  "ラベル配置": "Label placement",
  "抗体：左／分子量：右": "Antibody: left / molecular weight: right",
  "分子量：左／抗体：右": "Molecular weight: left / antibody: right",
  "Figure配置幅（編集可能PDF・グラフ）":
    "Figure placement width (editable PDF and graphs)",
  "小（25.5 mm）": "Small (25.5 mm)",
  "中（39 mm）": "Medium (39 mm)",
  "大（54 mm）": "Large (54 mm)",
  "確認・保全資料の用紙": "Review/source-record page size",
  "保全用Source recordに含める画像": "Images included in source record",
  "シグナル画像（CL）のみ": "Signal image (CL) only",
  "Merge画像のみ": "Merge image only",
  "シグナル画像とMerge画像の両方": "Both signal and Merge images",
  "ゲル間でブロットの並び替えを同期":
    "Synchronize blot order across gels",
  "編集可能Figure SVG（互換性は試験中）":
    "Editable Figure SVG (compatibility experimental)",
  "Illustrator向け編集可能PDF": "Editable PDF for Illustrator",
  "リンク不要の完成画像": "Self-contained final images",
  "Merge証拠保全SVG": "Source-record SVG",
  "作業プロジェクトJSON": "Project JSON",
  "全ファイルを個別ダウンロード": "Download all files separately",
  "保全用画像には視認性のため表示専用の自動階調補正を適用します。元画像は変更せず、軽量プロジェクトJSONにはファイル参照と処理設定だけを保存します。":
    "Source-record images receive display-only automatic levels for visibility. Original files remain unchanged; the lightweight project JSON stores file references and processing settings only.",
  "元画像の再リンクが必要です": "Source images must be relinked",
  "前回の自動保存があります": "An autosaved draft is available",
  "画像を含まない作業設定を復元します。元画像フォルダは再選択してください。":
    "Restore the saved workflow settings without embedded images. Please reselect the source-image folder.",
  "前回の作業を復元": "Restore previous work",
  "破棄して新規開始": "Discard and start new",
  "元画像フォルダを選択して復元": "Choose source-image folder and restore",
  "このJSONの元画像を含むフォルダを選択してください。相対パスを優先し、見つからない場合はファイル名で照合します。":
    "Choose the folder containing this JSON's source images. Relative paths are matched first, with file names used as a fallback.",
  "キャンセル": "Cancel",
  "プロジェクトの復元をキャンセルしました": "Project restoration was cancelled",
  "軽量プロジェクトJSONを保存しました。元画像フォルダと一緒に保管してください":
    "Saved a lightweight project JSON. Keep it with the source-image folder.",
  "軽量JSONを読み込みました。元画像フォルダを選択して再リンクしてください":
    "Loaded a lightweight JSON. Choose the source-image folder to relink the files.",
  "元画像を照合してプロジェクトを復元しています…":
    "Matching source images and restoring the project…",
  "SVGを経由せず画面の3倍解像度で直接描画します。安定した閲覧・提出にはこちらを推奨します。":
    "Rendered directly at three times the screen resolution without SVG. Recommended for stable viewing and submission.",
  "保存先はブラウザのダウンロード設定に従います。複数ダウンロードの確認が出た場合は許可してください。":
    "Files are saved according to browser download settings. Allow multiple downloads if prompted.",
  "Figureプレビュー": "Figure preview",
  "✎ 図中のラベルを編集": "✎ Edit labels in the Figure",
  "下の入力欄を書き換えると、Figureプレビューへ反映されます":
    "Changes in the fields below are reflected in the Figure preview.",
  "抗体名": "Antibody name",
  "定量用のブロットを選択": "Select blots for quantification",
  "元画像からバンドを測定する": "Measure bands from original images",
  "選択したブロットを測定": "Measure selected blots",
  "輝度調整をReset": "Reset display adjustment",
  "定量結果CSV": "Quantification results CSV",
  "ROI配置記録JSON": "ROI placement record (JSON)",
  "プロファイルを確認するレーン": "Lane to inspect",
  "縦方向Intensity profileを作成": "Generate vertical intensity profile",
  "元画像を解析中…": "Analyzing original pixels…",
  "ROI証拠保全PNG": "ROI evidence PNG",
  "定量QC": "Quantification QC",
  "飽和注意": "Saturation warning",
  "なし": "None",
  "元画像・ROI内を上から下へ走査":
    "Original pixels, scanned from top to bottom within the ROI",
  "ROI上端": "ROI top",
  "ROI下端": "ROI bottom",
  "BG補正Intensity": "BG-corrected intensity",
  "負の値はグラフ上では0として表示し、CSVには符号付きで保存します。ピーク範囲とbaselineの確定・積分は未実装です。":
    "Negative values are displayed as zero in the plot and retained with their sign in the CSV. Peak-range selection, baseline fitting, and integration are not yet implemented.",
  "ROI配置記録には、元画像名、回転角、各バンド枠と背景枠の座標（%・pixel）、測定時刻を保存します。作業プロジェクトJSONにもROIは保持されます。":
    "The ROI record stores the source-image name, rotation, band and background ROI coordinates (% and pixels), and measurement time. ROIs are also retained in the project JSON.",
  "定量化ワークスペース": "Quantification workspace",
  "定量に使うブロットを選びます。全体画像は見やすい表示に自動調整しますが、測定値は切り出していない元シグナル画像から計算します。":
    "Select blots to quantify. The full image is display-adjusted for visibility, while measurements use the uncropped original signal image.",
  "1つ以上のブロットを選択してください。": "Select at least one blot.",
  "背景差し引き後が0以下の場合": "When background-corrected signal is ≤ 0",
  "n.d.として数値解析から除外": "Exclude as n.d.",
  "0として解析に含める": "Include as zero",
  "グラフ・正規化に使う値": "Value used for graphs and normalization",
  "背景補正済み面積積分値": "Background-corrected integrated intensity",
  "背景補正済み平均輝度": "Background-corrected mean intensity",
  "背景は各ROIの直上・直下の領域から求めます。第1版のため、飽和警告とROI位置を確認してから値を使用してください。":
    "Background is estimated above and below each ROI. Check saturation warnings and ROI positions before using these beta measurements.",
  "定量するブロットを選択します": "Select blots to quantify",
  "左側から1つ以上選ぶと、レーン数に合わせてROIが自動配置されます。":
    "Select one or more blots on the left to place ROIs according to the lane count.",
  "グラフワークスペース": "Graph workspace",
  "定量結果をグラフにする": "Graph quantified results",
  "測定済みデータを論文図向けに整えます。軸は0から開始し、色覚多様性に配慮した配色を初期値にしています。":
    "Format measured data for publication figures. Axes start at zero and the default palette is color-vision accessible.",
  "グラフにするブロット": "Blot to graph",
  "グラフタイトル（任意）": "Graph title (optional)",
  "グラフ形式": "Graph format",
  "ドットプロット": "Dot plot",
  "配色セット": "Color palette",
  "Nature系（青・赤）": "Nature-style (blue/red)",
  "Okabe–Ito（色覚対応）": "Okabe–Ito (color-vision accessible)",
  "グレースケール": "Grayscale",
  "自作RGBセット": "Custom RGB set",
  "独自のRGB配色を作る": "Create a custom RGB palette",
  "先にStep 8で測定します": "Measure in Step 8 first",
  "ROIを確認して「選択したブロットを測定」を実行してください。":
    "Review the ROIs and run “Measure selected blots”.",
  "プロジェクトを復元しました": "Project restored",
  "グラフタイトル": "Graph title",
  "空欄ならタイトルなし": "Leave blank for no title",
  "グラフ種類": "Graph type",
  "棒グラフ": "Bar graph",
  "棒＋点": "Bars + points",
  "フォントサイズ": "Font size",
  "高さ": "Height",
  "各値を表示": "Show individual values",
  "現在のグラフPNGを書き出す": "Export current graph as PNG",
  "同じ抗体の全ゲルを1枚のPNGにまとめる":
    "Combine all gels for the same antibody into one PNG",
  "統計処理と独立反復の集約は将来のStep 10で追加予定です。":
    "Statistical analysis and aggregation of biological replicates are planned for Step 10.",
  "完了": "Done",
  "未選択": "Not selected",
  "未配置": "Not placed",
  "各画像・ゲルの水平を目視確認してください":
    "Visually confirm alignment for every image and gel",
  "あり": "Yes",
  "削除": "Delete",
};

const PATTERNS: Array<[RegExp, string]> = [
  [/^現在 (\d+)ゲル構成$/, "Current layout: $1 gel(s)"],
  [/^(\d+)画像・ゲルの水平を確認済み$/, "$1 image/gel combinations aligned"],
  [/^水平補正が未確認です（(\d+)\/(\d+)）$/, "Alignment needs confirmation ($1/$2)"],
  [/^(\d+) 撮影セット$/, "$1 Image sets"],
  [/^(\d+) 水平補正$/, "$1 Rotation"],
  [/^(\d+) 領域指定$/, "$1 Crop regions"],
  [/^(\d+) Figure用輝度調整$/, "$1 Figure adjustment"],
  [/^(\d+) マーカー$/, "$1 Markers"],
  [/^(\d+) 条件表$/, "$1 Lane labels"],
  [/^(\d+) 構成・出力$/, "$1 Layout and export"],
  [/^(\d+) 定量化$/, "$1 Quantification"],
  [/^(\d+) グラフ$/, "$1 Graphs"],
  [/^(.+)の共通横幅\s*$/, "$1 shared width "],
  [/^(.+)の共通高さ\s*$/, "$1 shared height "],
  [/^(.+)の回転 (.+)°$/, "$1 rotation $2°"],
  [/^(.+)のマーカーを設定$/, "Set markers for $1"],
  [/^次に配置：(.+)$/, "Place next: $1"],
  [/^黒点 (.+) ／ 白点 (.+)$/, "Black point $1 / white point $2"],
  [/^(lt|rt|lb|rb)角を変更$/, "Resize $1 corner"],
  [/^レーン(\d+)$/, "Lane $1"],
  [/^まとめラベル(\d+)$/, "Group label $1"],
  [/^(.+) まとめラベル(\d+)$/, "$1 group label $2"],
  [/^(.+)の抗体名$/, "$1 antibody name"],
  [/^(.+) の項目名$/, "$1 row label"],
  [/^(.+)の項目名$/, "$1 row label"],
  [/^(.+) レーン(\d+)$/, "$1 lane $2"],
  [/^Gel (\d+)$/, "Gel $1"],
];

const translate = (input: string) => {
  const direct = EN[input];
  if (direct) return direct;
  for (const [pattern, replacement] of PATTERNS)
    if (pattern.test(input)) return input.replace(pattern, replacement);
  return input;
};

const translateNode = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue || "";
    const trimmed = value.trim();
    if (!trimmed) return;
    const translated = translate(trimmed);
    if (translated !== trimmed)
      node.nodeValue = value.replace(trimmed, translated);
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  ["placeholder", "title", "aria-label"].forEach((attribute) => {
    const value = node.getAttribute(attribute);
    if (!value) return;
    const translated = translate(value);
    if (translated !== value) node.setAttribute(attribute, translated);
  });
};

const translateTree = (root: Node) => {
  translateNode(root);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  while (walker.nextNode()) translateNode(walker.currentNode);
};

export const isEnglishUi = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("lang") === "en";

export function useUiTranslation() {
  useEffect(() => {
    if (!isEnglishUi()) {
      document.documentElement.lang = "ja";
      return;
    }
    document.documentElement.lang = "en";
    document.title = "BlotCanvas Beta — Western blot figure workspace";
    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(translateTree);
        if (mutation.type === "characterData") translateNode(mutation.target);
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, []);
}
