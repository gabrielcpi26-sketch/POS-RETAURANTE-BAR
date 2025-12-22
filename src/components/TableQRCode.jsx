import { QRCodeCanvas } from "qrcode.react";

export default function TableQRCode({ areaId, tableId, size = 220 }) {
  const base = window.location.origin;
  const url = `${base}/m/mesa/${areaId}/${tableId}`;

  return (
    <div style={{ textAlign: "center" }}>
      <QRCodeCanvas id="pos-table-qr-canvas" value={url} size={size} />
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        {url}
      </div>
    </div>
  );
}
