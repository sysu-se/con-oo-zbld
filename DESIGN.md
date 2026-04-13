## A. 领域对象如何被消费

### 1. View 层消费的是 `gameStore`（Store Adapter）

View 层不直接接触 `Game` / `Sudoku`。`gameStore`（`stores/domain.js`）是唯一适配层：

```
组件（Board / Keyboard / Actions）
  ↓ $store 订阅 / on:click
gameStore          （stores/domain.js）
  ↓ _game.guess() / undo() / redo()
Game → Sudoku      （domain/index.js）
```

### 2. View 层拿到的数据

`gameStore` 的 `subscribe` 值为：

```js
{ puzzle: number[][], grid: number[][], canUndo: boolean, canRedo: boolean }
```

`stores/grid.js` 再用 `derived` 派生出：

| Store | 消费方 |
|-------|--------|
| `userGrid`（当前盘面） | Board / Keyboard / Actions |
| `grid`（原始题面） | `keyboardDisabled`（固定格判断） |
| `invalidCells`（冲突格，纯 UI 计算） | Cell.svelte（标红） |
| `gameWon`（胜利标志，纯 UI 计算） | App.svelte（胜利弹窗） |

### 3. 用户操作如何进入领域对象

**输入数字：**
`Keyboard on:click` → `userGrid.set()` → `gameStore.guess()` → `_game.guess()` → `_sync()`

**Undo / Redo：**
`Actions on:click` → `gameStore.undo()` / `gameStore.redo()` → `_game.undo()` / `_game.redo()` → `_sync()`

### 4. 领域对象变化后 Svelte 为什么会更新

`_sync()` 每次调用 `_internal.set({ puzzle, grid, canUndo, canRedo })`，传入全新对象引用（`getPuzzle()` / `getGrid()` 返回深拷贝）。Svelte 检测到引用变化，通知下游所有 `derived` store 和订阅组件重新计算。

---

## B. 响应式机制说明

### 1. 依赖的机制

使用 Svelte 3 的 `writable` / `derived` store，不使用 `$:` 或顶层 `let` 重新赋值。`gameStore` 对外只暴露 `subscribe` 和命令方法，组件无法直接写入。

### 2. 响应式暴露给 UI 的数据

| Store | 类型 | 用途 |
|-------|------|------|
| `gameStore` | writable（只读 subscribe） | 根 store |
| `userGrid` | derived | 盘面渲染与输入判断 |
| `grid`（puzzle） | derived | 固定格判断 |
| `invalidCells` | derived | 冲突格标红 |
| `gameWon` | derived | 胜利弹窗 |

### 3. 留在领域对象内部的状态

`_game` 是 `createGameStore` 闭包的私有变量，UI 不可见：`Game.history`、`Game.future`、`Sudoku.puzzle`、`Sudoku.grid`。UI 只能读到 `_sync()` 推出的只读快照。

### 4. 直接 mutate 内部对象的问题

Svelte 只感知赋值操作。若直接改对象属性（如 `s.grid[0][0] = 5` 后 `return s`），引用不变，UI 不刷新；若绕过 `gameStore` 修改 `Sudoku.grid`，`canUndo`/`canRedo` 不更新，历史与盘面不一致。

---

## C. 改进说明

### 1. 相比 HW1 改进了什么

| 方面 | HW1 | HW1.1 |
|------|-----|-------|
| 领域对象接入 | `userGrid` 独立 store，绕开 `Game.guess()`，历史永远为空 | 全部走 `gameStore.guess()` → `_game.guess()`，领域对象是唯一数据源 |
| Undo / Redo | 按钮无事件绑定，点击无效 | 绑定 `gameStore.undo/redo()`，`disabled` 由 `canUndo/canRedo` 驱动 |
| 固定格保护 | 无 `puzzle` 字段，无法区分题目格 | 新增 `isFixed()`，`guess()` 两层均做检查 |
| 防御性拷贝 | `toJSON()` 返回内部引用，外部可污染 | 构造器、序列化、`getSudoku()` 均做深/浅拷贝 |
| 单格读取 | `getGrid()[row][col]`（深拷贝 81 格读一格） | 新增 `getCell(row, col)`，O(1) 读取 |

### 2. 为什么 HW1 不足以支撑真实接入

HW1 的领域对象与 UI 并行存在但互不通信：输入不经过 `Game.guess()`，Undo/Redo 无法被调用，`invalidCells` 与领域状态不绑定。真实接入要求通过 Store Adapter 严格单向连接。

### 3. 新设计的 Trade-off

| 决策 | 优点 | 代价 |
|------|------|------|
| `_sync()` 全量快照 | 变化检测可靠，逻辑简单 | 每次两次深拷贝（O(162)），规模增大时需局部更新 |
| 保持原有 store 接口 | 消费方无需改动 | `userGrid.set()` 语义改变，需熟悉调用链 |
| 领域对象完全私有 | 防止外部绕过 `gameStore` | 调试需借助 Svelte devtools，不能直接访问 `_game` |
| `invalidCells`/`gameWon` 留在 UI 层 | 领域层保持纯粹 | 冲突检测逻辑无法在服务端复用 |
