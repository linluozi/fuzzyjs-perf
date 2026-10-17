# 许可证说明

## 上游状态（本文写作时，`gjuchault/fuzzyjs` @ `ffd9898`）

| 项 | 值 | 来源 |
|---|---|---|
| `package.json` 的 `license` 字段 | `MIT` | 仓库内 `package.json` |
| npm 发布包 `fuzzyjs@5.0.1` 的 `license` | `MIT` | npm registry 元数据 |
| 仓库根目录是否有 `LICENSE` / `COPYING` 文件 | **没有** | `git ls-files` 无匹配；GitHub API `license: null` |

也就是说：**项目声明自己是 MIT，但仓库里没有放许可证正文。** 这是常见疏漏，不影响声明本身的有效性（`package.json` 与 npm 元数据都明确写了 MIT），但会让下游使用者在"要不要附版权声明"这件事上缺少可引用的文本。

## 本补丁的授权

本补丁是对 MIT 项目的修改版，按 **MIT** 分发，与上游保持一致。你可以自由使用、修改、再分发，包括商用，前提是保留版权声明与许可声明。

## MIT 许可证标准正文

下面是 SPDX 官方 `MIT` 模板，版权行按上游 `package.json` 的 `author` 字段填写。如果上游后续补了 `LICENSE` 文件，以仓库里的版本为准。

```text
MIT License

Copyright (c) Gabriel Juchault

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 建议上游做的事

1. 在仓库根目录加 `LICENSE` 文件（内容同上）。
2. `package.json` 加 `"files"` 白名单，避免发布时把 `src/` 之外的调试产物带进包里（当前没有 `files` 字段，`.npmignore` 只排除了三类目录）。
3. 如果维护者希望用别的许可证，需要在 `LICENSE`、`package.json`、README 三处同时改，否则下游无法判断以哪个为准。

## 本补丁没有做的事

- 没有改 `package.json` 的 `license` 字段（仍是 `MIT`）。
- 没有替上游创建 `LICENSE` 文件——版权归属应由维护者自己声明。本仓库（fork）根目录的 `LICENSE` 是给**这个 fork** 用的：它同时标注上游与本仓库修改的版权，好让 GitHub 的许可证识别显示 MIT 而不是 "Other"；它不会被放进补丁。
- 没有引入任何新依赖，因此不涉及第三方许可证兼容性问题。
