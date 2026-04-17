# con-oo-zbld - Review

## Review 结论

当前实现已经完成了基础接入：开局、棋盘渲染、输入、Undo/Redo 都能沿着 Svelte store -> Game/Sudoku 的链路工作；但领域边界仍不稳，数独校验、胜负判定、提示与笔记等关键业务还散落在 store/UI 层，导致 OOP/OOD 质量只能算中等。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 笔记模式会污染 Game 的撤销历史

- 严重程度：core
- 位置：src/components/Controls/Keyboard.svelte:12-18, src/domain/index.js:120-126
- 原因：笔记模式下每次增删 candidate 都会执行 `userGrid.set($cursor, 0)`，最终进入 `Game.guess(...)`。当该格本来就是 0 时，棋盘并没有变化，但 `Game.guess` 仍然无条件写入 history。这样 Undo/Redo 会混入“纯 UI 笔记操作”，不符合数独业务，也说明领域对象没有把真正的游戏状态与视图辅助状态区分清楚。

### 2. 数独校验与胜利判定没有由领域对象统一负责

- 严重程度：core
- 位置：src/node_modules/@sudoku/stores/grid.js:53-97, src/node_modules/@sudoku/stores/game.js:7-20, src/domain/index.js:59-75
- 原因：`Sudoku` 虽然提供了 `validate()`，但真实界面并没有消费它；冲突格计算和胜利判定被重新写在 `invalidCells` 与 `gameWon` 里。这样业务规则出现了双份实现，`Sudoku/Game` 不是唯一真源，后续一旦规则调整，领域层与 UI/store 很容易漂移。

### 3. 领域对象对自身不变量维护不足

- 严重程度：major
- 位置：src/domain/index.js:22-29, src/domain/index.js:47-53, src/domain/index.js:85-86, src/domain/index.js:120-126
- 原因：`Sudoku` 构造器只校验了 `puzzle` 的 9x9 形状，没有校验 `grid` 的形状和值域；`fromJSON()` 直接信任外部数据；`guess()` 对非法输入选择静默返回；而 `Game.guess()` 又默认 move 可用并继续写历史。作为公共领域 API，这会让非法状态和“失败操作”难以被识别，也削弱了对象封装。

### 4. 提示操作没有进入 Game 的统一游戏操作入口

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:42-50
- 原因：`applyHint()` 在 store 中直接读取当前 grid、调用求解器、扣减 hints，再把结果写回 `gameStore.guess(...)`。这说明一个真实 UI 动作被拆散在多个 store/工具函数里，`Game` 并没有成为面向 UI 的完整游戏门面，OOD 边界仍然偏散。

### 5. 根组件直接订阅 store 且未清理，不符合常见 Svelte 习惯

- 严重程度：minor
- 位置：src/App.svelte:12-17
- 原因：`gameWon.subscribe(...)` 写在组件顶层且没有取消订阅。虽然根组件通常只挂载一次，但这仍然不是典型的 Svelte 写法；在热更新或重复挂载场景下容易留下重复订阅，建议改成 `$gameWon` 驱动的 reactive statement，或在生命周期中显式清理。

## 优点

### 1. 使用了明确的 Store Adapter 来桥接领域对象与 Svelte

- 位置：src/node_modules/@sudoku/stores/domain.js:8-55
- 原因：`createGameStore()` 把可变的 `Game` 封装在 store 内部，并通过 `_internal.set(...)` 发布普通快照，正确利用了 Svelte 依赖“重新赋值/重新 set”触发更新的机制。这个接法符合题目推荐方案。

### 2. 真实游戏主流程已经接到了领域层

- 位置：src/node_modules/@sudoku/game.js:13-33, src/node_modules/@sudoku/stores/grid.js:16-21, src/node_modules/@sudoku/stores/grid.js:35-50, src/components/Controls/ActionBar/Actions.svelte:27-33
- 原因：开始新局会创建新的 `Game/Sudoku`，棋盘渲染读取的是 `gameStore` 派生出的 `grid/userGrid`，用户输入经由 `gameStore.guess(...)`，Undo/Redo 直接调用 `gameStore.undo/redo()`。组件没有再直接改二维数组，这一点满足了“真实接入”的核心要求。

### 3. Undo/Redo 历史被封装在 Game 内部，而不是散落在组件里

- 位置：src/domain/index.js:106-168
- 原因：`Game` 自己持有 `sudoku/history/future`，并提供 `guess/undo/redo/canUndo/canRedo/toJSON`。至少在职责分布上，撤销重做已经从 UI 层回收到领域对象中。

### 4. 对外暴露时做了防御性拷贝和序列化接口

- 位置：src/domain/index.js:22-37, src/domain/index.js:55-56, src/domain/index.js:78-86
- 原因：`Sudoku` 在构造、getter、clone、toJSON/fromJSON` 上都避免把内部数组直接暴露出去，能降低外部直接 mutate 内部棋盘的风险，这对 Svelte 接入尤其重要。

## 补充说明

- 本结论仅基于静态阅读，没有运行测试，也没有实际点击界面；因此关于 Undo/Redo、提示、胜利弹窗等行为的判断都来自静态调用链推断。
- 本次审查范围限制在 `src/domain/index.js` 及其关联的 Svelte 接入文件：`src/node_modules/@sudoku/stores/domain.js`、`src/node_modules/@sudoku/stores/grid.js`、`src/node_modules/@sudoku/stores/game.js`、`src/node_modules/@sudoku/game.js`、`src/node_modules/@sudoku/stores/keyboard.js`、`src/App.svelte`、`src/components/Board/index.svelte`、`src/components/Controls/Keyboard.svelte`、`src/components/Controls/ActionBar/Actions.svelte`、`src/components/Header/Dropdown.svelte`。
- 未扩展审查到无关目录；`cursor`、`candidates`、`hints` 等模块只在它们影响领域接入判断的位置做了必要的静态阅读。
