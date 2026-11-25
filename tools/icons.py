"""Generate icons/*.png (indigo rounded square + white play triangle). Pure stdlib: python3 tools/icons.py"""
import struct, zlib, pathlib

def png(size):
    ss = 4  # supersampling for smooth edges
    r = 0.22 * size
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            bg = tri = 0
            for sy in range(ss):
                for sx in range(ss):
                    px, py = x + (sx + .5) / ss, y + (sy + .5) / ss
                    dx, dy = max(r - px, px - (size - r), 0), max(r - py, py - (size - r), 0)
                    if dx * dx + dy * dy <= r * r:
                        bg += 1
                        u, v = px / size, py / size  # triangle (0.38,0.28)-(0.38,0.72)-(0.74,0.5)
                        if u >= .38 and abs(v - .5) <= (.74 - u) * (.22 / .36):
                            tri += 1
            n = ss * ss
            a, t = bg / n, tri / max(bg, 1)
            rgb = [round(c * (1 - t) + 255 * t) for c in (79, 70, 229)]
            row += bytes(rgb + [round(a * 255)])
        rows.append(bytes(row))
    chunk = lambda tag, data: struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))

out = pathlib.Path(__file__).resolve().parent.parent / "icons"
out.mkdir(exist_ok=True)
for s in (16, 32, 48, 128):
    (out / f"{s}.png").write_bytes(png(s))
