from __future__ import annotations

import os
import json
from html import escape
from collections import defaultdict
from collections.abc import Mapping
from typing import Any

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="LayerScope API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGIN", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _layer_name(info: Mapping[str, Any]) -> str:
    name = info.get("name")
    return str(name).strip() if name else "Unnamed layer"


def _page_stats(document: fitz.Document) -> tuple[int, int, dict[str, dict[str, Any]]]:
    pages = 0
    objects = 0
    layer_stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"pages": set(), "objects": 0})
    for page in document:
        drawings = page.get_drawings()
        text_blocks = page.get_text("blocks")
        if drawings or text_blocks:
            pages += 1
        objects += len(drawings) + len(text_blocks)
        for drawing in drawings:
            layer = drawing.get("layer")
            if layer:
                stats = layer_stats[str(layer)]
                stats["pages"].add(page.number + 1)
                stats["objects"] += 1
    return pages, objects, layer_stats


def _drawing_svg(page: fitz.Page, visible_layers: set[str]) -> str:
    width = page.rect.width
    height = page.rect.height
    paths: list[str] = []
    for drawing in page.get_drawings():
        if drawing.get("layer") not in visible_layers:
            continue
        color = drawing.get("color") or drawing.get("fill") or (0, 0, 0)
        stroke = "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, round(channel * 255))) for channel in color))
        stroke_width = max(float(drawing.get("width") or 0.5), 0.25)
        commands: list[str] = []
        for item in drawing.get("items", []):
            if item[0] == "l":
                commands.append(f"M {item[1].x:g} {item[1].y:g} L {item[2].x:g} {item[2].y:g}")
            elif item[0] == "c":
                commands.append(
                    f"M {item[1].x:g} {item[1].y:g} C {item[2].x:g} {item[2].y:g}, "
                    f"{item[3].x:g} {item[3].y:g}, {item[4].x:g} {item[4].y:g}"
                )
            elif item[0] == "re":
                rect = item[1]
                commands.append(f"M {rect.x0:g} {rect.y0:g} H {rect.x1:g} V {rect.y1:g} H {rect.x0:g} Z")
        if commands:
            paths.append(
                f'<path d="{escape(" ".join(commands))}" fill="none" stroke="{stroke}" '
                f'stroke-width="{stroke_width:g}" />'
            )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}"><rect width="100%" height="100%" fill="white"/>'
        f'{"".join(paths)}</svg>'
    )


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")

    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid PDF.")

    try:
        document = fitz.open(stream=data, filetype="pdf")
        page_count = document.page_count
        pages_with_content, object_count, layer_stats = _page_stats(document)
        ocgs = document.get_ocgs() or {}
        layers = [
            {
                "id": f"pdf-layer-{xref}",
                "name": _layer_name(info),
                "pages": sorted(layer_stats.get(_layer_name(info), {}).get("pages", set())),
                "objects": layer_stats.get(_layer_name(info), {}).get("objects", 0),
                "size": "—",
                "description": "Optional content group extracted by PyMuPDF.",
                "visible": True,
            }
            for xref, info in ocgs.items()
        ]
        if not layers:
            layers = [
                {
                    "id": "document-content",
                    "name": "Document content",
                    "pages": list(range(1, page_count + 1)),
                    "objects": object_count,
                    "size": f"{len(data) / 1024:.0f} KB",
                    "description": "No optional content groups were found; all page content is shown together.",
                    "visible": True,
                }
            ]
        return {
            "filename": file.filename or "drawing.pdf",
            "size_bytes": len(data),
            "page_count": page_count,
            "has_layers": bool(ocgs),
            "pages_with_content": pages_with_content,
            "content_objects": object_count,
            "layers": layers,
        }
    except (fitz.FileDataError, RuntimeError) as error:
        raise HTTPException(status_code=422, detail=f"Could not analyze PDF: {error}") from error
    finally:
        if "document" in locals():
            document.close()


@app.post("/render")
async def render(
    file: UploadFile = File(...),
    page: int = Form(1),
    visible_layers: str = Form("[]"),
) -> Response:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")
    if page < 1:
        raise HTTPException(status_code=400, detail="Page numbers start at 1.")

    try:
        requested_layers = json.loads(visible_layers)
        if not isinstance(requested_layers, list) or not all(isinstance(item, str) for item in requested_layers):
            raise ValueError
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail="visible_layers must be a JSON array of layer names.") from error

    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid PDF.")

    document: fitz.Document | None = None
    try:
        document = fitz.open(stream=data, filetype="pdf")
        if page > document.page_count:
            raise HTTPException(status_code=400, detail=f"Page must be between 1 and {document.page_count}.")

        ocgs = document.get_ocgs() or {}
        names_to_xrefs = {_layer_name(info): xref for xref, info in ocgs.items()}
        if ocgs:
            on = [names_to_xrefs[name] for name in requested_layers if name in names_to_xrefs]
            off = [xref for xref in ocgs if xref not in on]
            document.set_layer(-1, on=on, off=off)
        elif ocgs:
            document.set_layer(-1, on=[], off=list(ocgs))

        if ocgs:
            svg = _drawing_svg(document[page - 1], set(requested_layers))
            return Response(content=svg.encode("utf-8"), media_type="image/svg+xml")
        pixmap = document[page - 1].get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False)
        return Response(content=pixmap.tobytes("png"), media_type="image/png")
    except HTTPException:
        raise
    except (fitz.FileDataError, RuntimeError) as error:
        raise HTTPException(status_code=422, detail=f"Could not render PDF: {error}") from error
    finally:
        if document is not None:
            document.close()
