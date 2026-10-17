"""Renders the report charts from the measured JSON, never from retyped numbers.

    python bench/plot.py

Inputs : bench/results.json, bench/call-counts-{head,patched}.json
Outputs: docs/perf-comparison.png, docs/call-counts.png
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FixedLocator, NullFormatter  # noqa: E402
from matplotlib.transforms import blended_transform_factory  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

CREAM = "#FBF7F1"
INK = "#2A211B"
MUTED = "#8B7A68"
GRID = "#E4D9CB"
HEAD = "#C9B7A3"
PATCHED = "#C8811F"
ACCENT = "#A6402A"

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": ["Microsoft YaHei", "DejaVu Sans"],
        "axes.unicode_minus": False,
        "figure.facecolor": CREAM,
        "axes.facecolor": CREAM,
        "savefig.facecolor": CREAM,
        "text.color": INK,
        "axes.labelcolor": INK,
        "xtick.color": MUTED,
        "ytick.color": INK,
    }
)

# Display names for the scenarios measured by bench/run.mjs.
LABELS = {
    "sort:cities:ah": ("排序 · 5,977 城市名 · query “ah”", "sort"),
    "sort:cities:a": ("排序 · 5,977 城市名 · query “a”", "sort"),
    "sort:mixed:ssjs": ("排序 · 2,000 混合姓名 · “ssjs”（×3 轮）", "sort"),
    "sort:mixed:nomatch": ("排序 · 2,000 混合姓名 · 全不匹配（×5 轮）", "sort"),
    "sort:dupes": ("排序 · 1,000 项 / 10 个不同 source（×50 轮）", "sort"),
    "sort:long": ("排序 · 500 条约 200 字符长文本", "sort"),
    "sort:cities:caseSensitive": ("排序 · 大小写敏感", "sort"),
    "filter:cities:ah": ("过滤 · 5,977 城市名（走 test）", "filter"),
    "match:hot": ("match() 热循环 × 15 万", "micro"),
    "test:hot": ("test() 热循环 × 40 万", "micro"),
    "test:earlyExit": ("test() · 2,001 字符 × 20 万", "micro"),
}


def load(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def footer(fig, text):
    fig.text(0.013, 0.018, text, fontsize=8.4, color=MUTED, ha="left", va="bottom")


def style_axis(ax):
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(axis="both", length=0, labelsize=10.5)
    ax.grid(axis="x", color=GRID, linewidth=0.8, alpha=0.9)
    ax.set_axisbelow(True)


def chart_comparison():
    data = load(ROOT / "bench" / "results.json")
    rows = []
    for key, (label, group) in LABELS.items():
        result = data["results"][key]
        base = result["baseline"]["best"]
        new = result["candidate"]["best"]
        rows.append((base / new, label, base, new, key))

    rows.sort(key=lambda row: row[0])  # smallest speedup at the bottom
    ys = range(len(rows))

    fig, ax = plt.subplots(figsize=(12.4, 7.0))
    fig.subplots_adjust(left=0.30, right=0.865, top=0.845, bottom=0.115)

    column = blended_transform_factory(ax.transAxes, ax.transData)

    for y, (speedup, _label, base, new, _key) in zip(ys, rows):
        ax.plot([new, base], [y, y], color=INK, linewidth=1.2, alpha=0.30, zorder=2)
        ax.scatter([base], [y], s=78, color=HEAD, edgecolor=CREAM, linewidth=1.6, zorder=3)
        ax.scatter([new], [y], s=92, color=PATCHED, edgecolor=CREAM, linewidth=1.6, zorder=4)
        ax.text(
            1.03,
            y,
            f"{speedup:.1f}×",
            transform=column,
            va="center",
            ha="left",
            fontsize=11.5,
            fontweight="bold",
            color=ACCENT,
        )

    ax.text(
        1.03,
        1.015,
        "提速",
        transform=ax.transAxes,
        va="bottom",
        ha="left",
        fontsize=9.5,
        color=MUTED,
    )

    ax.set_yticks(list(ys))
    ax.set_yticklabels([row[1] for row in rows], fontsize=10.5)
    ax.set_xscale("log")
    ax.set_xlim(1.7, 2600)
    ticks = [3, 10, 30, 100, 300, 1000]
    ax.xaxis.set_major_locator(FixedLocator(ticks))
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.set_xlabel("单次场景耗时（ms，对数轴）→ 越靠左越快", fontsize=10.5, color=MUTED, labelpad=8)
    style_axis(ax)

    fig.text(0.013, 0.945, "fuzzyjs：优化前后对比", fontsize=23, fontweight="bold", color=INK)
    fig.text(
        0.013,
        0.885,
        "同一个算法、同一套数据，只改实现。排序最多快 33×，因为 0 分项过去每次比较都要重算。",
        fontsize=11.6,
        color=MUTED,
    )

    # Legend.
    handles = [
        plt.Line2D([], [], marker="o", linestyle="", markersize=9, color=HEAD, label="HEAD"),
        plt.Line2D([], [], marker="o", linestyle="", markersize=9, color=PATCHED, label="补丁后"),
    ]
    ax.legend(
        handles=handles,
        loc="lower right",
        frameon=False,
        fontsize=10.5,
        handletextpad=0.4,
        borderpad=0.2,
    )

    footer(
        fig,
        "数据 bench/results.json · Node v22.22.2 / Windows 11 x64 · 每组合独立进程 · A/B 交错 · best-of-7×4 · 小场景重复多轮以压过计时噪声",
    )
    DOCS.mkdir(exist_ok=True)
    out = DOCS / "perf-comparison.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    print(f"wrote {out.relative_to(ROOT)}")


def chart_call_counts():
    head = {row["label"]: row for row in load(ROOT / "bench" / "call-counts-head.json")["records"]}
    patched = {
        row["label"]: row for row in load(ROOT / "bench" / "call-counts-patched.json")["records"]
    }

    picked = [
        ("1000 items / 10 distinct, all zero", "1,000 项 / 10 个不同 source"),
        ("cities 'ah' (many zero scores)", "5,977 城市名 · “ah”"),
        ("cities 'a'", "5,977 城市名 · “a”"),
        ("1000 distinct, score exactly 0", "1,000 项 · 匹配但分数恰为 0"),
        ("1000 distinct, all matching", "1,000 项 · 全部命中（对照）"),
    ]

    rows = []
    for key, label in picked:
        rows.append((label, head[key]["distinct"], head[key]["calls"], patched[key]["calls"]))

    fig, ax = plt.subplots(figsize=(12.4, 5.6))
    fig.subplots_adjust(left=0.30, right=0.855, top=0.795, bottom=0.16)

    column = blended_transform_factory(ax.transAxes, ax.transData)

    bar_h = 0.34
    for index, (label, _distinct, calls_head, calls_patched) in enumerate(rows):
        y = len(rows) - 1 - index
        ax.barh(y + bar_h / 2, calls_head, height=bar_h, color=HEAD, zorder=3)
        ax.barh(y - bar_h / 2, calls_patched, height=bar_h, color=PATCHED, zorder=3)
        ax.annotate(
            f"{calls_head:,}",
            xy=(calls_head, y + bar_h / 2),
            xytext=(6, 0),
            textcoords="offset points",
            va="center",
            fontsize=9.6,
            color=MUTED,
        )
        if calls_patched < calls_head * 0.9:
            ax.annotate(
                f"{calls_patched:,}",
                xy=(calls_patched, y - bar_h / 2),
                xytext=(6, 0),
                textcoords="offset points",
                va="center",
                fontsize=9.6,
                color=INK,
            )
        ratio = calls_head / calls_patched if calls_patched else 0
        strong = ratio >= 1.5
        ax.text(
            1.03,
            y,
            f"×{ratio:.2f} 冗余" if strong else "已经是 1.00",
            transform=column,
            va="center",
            ha="left",
            fontsize=10.5,
            color=ACCENT if strong else MUTED,
            fontweight="bold" if strong else "normal",
        )

    ax.set_yticks([len(rows) - 1 - i for i in range(len(rows))])
    ax.set_yticklabels([row[0] for row in rows], fontsize=10.5)
    ax.set_xscale("log")
    ax.set_xlim(5, 90000)
    ax.xaxis.set_major_locator(FixedLocator([10, 100, 1000, 10000]))
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.set_xlabel("一次 sort() 期间 match() 被进入的次数（对数轴）", fontsize=10.5, color=MUTED, labelpad=8)
    style_axis(ax)

    ax.text(
        1.03,
        1.015,
        "相对去重数",
        transform=ax.transAxes,
        va="bottom",
        ha="left",
        fontsize=9.5,
        color=MUTED,
    )

    fig.text(0.013, 0.93, "缓存命中判断：0 分被当成“没算过”", fontsize=22, fontweight="bold")
    fig.text(
        0.013,
        0.862,
        "每个 source 只需要算一次。旧代码用真值判断命中，而 0 是最常见的分数，于是零分项每次比较都重算。",
        fontsize=11.4,
        color=MUTED,
    )

    handles = [
        matplotlib.patches.Patch(color=HEAD, label="HEAD"),
        matplotlib.patches.Patch(color=PATCHED, label="补丁后"),
    ]
    fig.legend(
        handles=handles,
        loc="upper right",
        bbox_to_anchor=(0.987, 0.965),
        ncol=2,
        frameon=False,
        fontsize=10.5,
        handletextpad=0.5,
        columnspacing=1.4,
    )

    footer(fig, "数据 bench/call-counts-{head,patched}.json · 插桩仅在 match() 入口加一行计数器，其余源码逐字节相同")
    out = DOCS / "call-counts.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    chart_comparison()
    chart_call_counts()
