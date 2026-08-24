using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class ManoaOrb : Form
{
    static readonly int SZ = 64;
    static readonly int MG = 20;
    static readonly string URL = "http://localhost:5173";

    PictureBox pbox;
    System.Windows.Forms.Timer pingTimer;
    bool pingOn = true;
    bool dragging = false;
    Point dragOffset;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new ManoaOrb());
    }

    public ManoaOrb()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string imgPath = Path.Combine(dir, "manoa.jpg");
        if (!File.Exists(imgPath))
            imgPath = Path.Combine(dir, "frontend", "public", "manoa.jpg");

        Image original = null;
        if (File.Exists(imgPath))
            original = Image.FromFile(imgPath);

        Bitmap circular = new Bitmap(SZ, SZ);
        using (Graphics g = Graphics.FromImage(circular))
        {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.Clear(Color.FromArgb(0, 0, 0, 0));
            GraphicsPath clip = new GraphicsPath();
            clip.AddEllipse(0, 0, SZ, SZ);
            g.SetClip(clip);
            if (original != null)
                g.DrawImage(original, 0, 0, SZ, SZ);
            clip.Dispose();
        }

        GraphicsPath gp = new GraphicsPath();
        gp.AddEllipse(0, 0, SZ, SZ);
        Region = new Region(gp);

        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        TopMost = true;
        ShowInTaskbar = false;
        Size = new Size(SZ, SZ);
        BackColor = Color.FromArgb(20, 20, 20);

        Screen wa = Screen.PrimaryScreen;
        int posX = wa.WorkingArea.Right - SZ - MG;
        int posY = wa.WorkingArea.Bottom - SZ - MG;
        Location = new Point(posX, posY);

        pbox = new PictureBox();
        pbox.Size = new Size(SZ, SZ);
        pbox.Location = new Point(0, 0);
        pbox.Image = circular;
        pbox.SizeMode = PictureBoxSizeMode.StretchImage;
        pbox.BackColor = Color.Transparent;
        pbox.Cursor = Cursors.Hand;
        Controls.Add(pbox);

        pingTimer = new System.Windows.Forms.Timer();
        pingTimer.Interval = 1500;
        pingTimer.Tick += (s, e) => { pingOn = !pingOn; pbox.Invalidate(); };
        pingTimer.Start();

        pbox.Paint += (s, e) =>
        {
            if (pingOn)
            {
                using (SolidBrush br = new SolidBrush(Color.FromArgb(200, 74, 222, 128)))
                    e.Graphics.FillEllipse(br, SZ - 10, 0, 14, 14);
            }
        };

        ToolTip tip = new ToolTip();
        tip.SetToolTip(pbox, "MANOA - Cliquez pour ouvrir l'assistant");

        pbox.MouseDown += (s, e) =>
        {
            if (e.Button == MouseButtons.Left)
            {
                dragging = true;
                dragOffset = e.Location;
            }
        };
        pbox.MouseMove += (s, e) =>
        {
            if (dragging)
                Location = new Point(Location.X + e.X - dragOffset.X, Location.Y + e.Y - dragOffset.Y);
        };
        pbox.MouseUp += (s, e) => { dragging = false; };

        pbox.Click += (s, e) =>
        {
            if (((MouseEventArgs)e).Button == MouseButtons.Left)
                Process.Start(URL);
        };

        MouseDown += (s, e) =>
        {
            if (e.Button == MouseButtons.Right)
            {
                if (pingTimer != null)
                {
                    pingTimer.Stop();
                    pingTimer.Dispose();
                }
                Close();
            }
        };
    }
}
