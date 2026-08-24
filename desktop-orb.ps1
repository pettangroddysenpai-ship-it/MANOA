# MANOA Desktop Orb
# Small floating MANOA icon on the Windows desktop (bottom-right).
# Left-click opens the app. Right-click closes the orb.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$imagePath = Join-Path $scriptDir "frontend\public\manoa.jpg"

# --- Config ---
$orbSize   = 64
$margin    = 20
$appUrl    = "http://localhost:5173"

# --- Load image ---
if (-not (Test-Path $imagePath)) { exit 1 }
$originalImage = [System.Drawing.Image]::FromFile($imagePath)

# --- Create circular image ---
$bmp = New-Object System.Drawing.Bitmap($orbSize, $orbSize)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$clipPath.AddEllipse(0, 0, $orbSize, $orbSize)
$g.SetClip($clipPath)
$g.DrawImage($originalImage, 0, 0, $orbSize, $orbSize)
$g.Dispose()
$clipPath.Dispose()

# --- Create round region ---
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$gp.AddEllipse(0, 0, $orbSize, $orbSize)
$roundRegion = New-Object System.Drawing.Region($gp)

# --- Create the orb form ---
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.Size = New-Object System.Drawing.Size($orbSize, $orbSize)
$form.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$form.Region = $roundRegion

# --- PictureBox ---
$pbox = New-Object System.Windows.Forms.PictureBox
$pbox.Size = New-Object System.Drawing.Size($orbSize, $orbSize)
$pbox.Location = New-Object System.Drawing.Point(0, 0)
$pbox.Image = $bmp
$pbox.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::StretchImage
$pbox.BackColor = [System.Drawing.Color]::Transparent
$pbox.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($pbox)

# --- Green ping dot ---
$pingOn = $true
$pingTimer = New-Object System.Windows.Forms.Timer
$pingTimer.Interval = 1500
$pingTimer.Add_Tick({
    $pingOn = -not $pingOn
    $pbox.Invalidate()
})
$pbox.Add_Paint({
    param($sender, $e)
    if ($pingOn) {
        $g = $e.Graphics
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 74, 222, 128))
        $g.FillEllipse($brush, $orbSize - 10, 0, 14, 14)
        $brush.Dispose()
    }
})

# --- Tooltip ---
$tooltip = New-Object System.Windows.Forms.ToolTip
$tooltip.SetToolTip($pbox, "MANOA - Cliquez pour ouvrir l'assistant")

# --- Dragging ---
$dragging = $false
$dragOffset = New-Object System.Drawing.Point
$pbox.Add_MouseDown({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:dragging = $true
        $script:dragOffset = $e.Location
    }
})
$pbox.Add_MouseMove({
    param($sender, $e)
    if ($script:dragging) {
        $form.Location = New-Object System.Drawing.Point(
            $form.Location.X + $e.X - $script:dragOffset.X,
            $form.Location.Y + $e.Y - $script:dragOffset.Y
        )
    }
})
$pbox.Add_MouseUp({ $script:dragging = $false })

# --- Left-click opens app ---
$pbox.Add_Click({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        Start-Process $appUrl
    }
})

# --- Right-click closes orb ---
$form.Add_MouseDown({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
        $pingTimer.Stop()
        $pingTimer.Dispose()
        $form.Close()
    }
})

# --- Position bottom-right ---
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$posX = $wa.X + $wa.Width  - $orbSize - $margin
$posY = $wa.Y + $wa.Height - $orbSize - $margin
$form.Location = New-Object System.Drawing.Point($posX, $posY)

# --- Cleanup ---
$form.Add_FormClosed({
    $pingTimer.Dispose()
    $bmp.Dispose()
    $originalImage.Dispose()
    $gp.Dispose()
})

# --- Run ---
$pingTimer.Start()
[System.Windows.Forms.Application]::Run($form)
