<template>
  <div class="better-virtual-scroll-table" ref="container">
    <!-- 表头 -->
    <div class="table-header" ref="header">
      <div
        v-for="column in columns"
        :key="column.key"
        :class="['header-cell', { sortable: column.sortable }]"
        :style="{ width: column.width + 'px', minWidth: column.minWidth + 'px' }"
        @click="handleSort(column)"
      >
        {{ column.title }}
        <span v-if="column.sortable && sortColumn === column.key" class="sort-icon">
          {{ sortDirection === 'asc' ? '↑' : '↓' }}
        </span>
      </div>
    </div>
    <!-- 虚拟滚动内容区域 -->
    <div class="table-body" :style="{ height: actualContainerHeight + 'px' }" ref="body" @scroll="onScroll">
      <div v-if="offsetTop > 0" :style="{ height: offsetTop + 'px' }" class="virtual-spacer"></div>
      <div
        v-for="(item, idx) in visibleItems"
        :key="item.id || `item-${startIndex + idx}`"
        :class="['table-row', { highlighted: highlightedRowId === item.id, 'row-even': (startIndex + idx) % 2 === 0, 'row-odd': (startIndex + idx) % 2 === 1 }]"
        :style="{ height: itemHeight + 'px' }"
        @click="$emit('row-click', item)"
      >
        <div
          v-for="column in columns"
          :key="column.key"
          :class="['table-cell', column.align || 'left']"
          :style="{ width: column.width + 'px', minWidth: column.minWidth + 'px' }"
        >
          <slot
            v-if="column.slot"
            :name="column.slot"
            :item="item"
            :value="getColumnValue(item, column.key)"
            :index="startIndex + idx"
          />
          <span v-else :title="getColumnValue(item, column.key)">
            {{ formatValue(getColumnValue(item, column.key), column.format) }}
          </span>
        </div>
      </div>
      <div v-if="offsetBottom > 0" :style="{ height: offsetBottom + 'px' }" class="virtual-spacer"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BetterVirtualScrollTable',
  props: {
    data: { type: Array, default: () => [] },
    columns: { type: Array, required: true },
    itemHeight: { type: Number, default: 28 }, // 压缩默认行高为28px，与普通表格保持一致
    containerHeight: { type: Number, default: 400 },
    highlightedRowId: { type: [String, Number], default: null },
    bufferSize: { type: Number, default: 10 }
  },
  data() {
    return {
      scrollTop: 0,
      sortColumn: null,
      sortDirection: 'asc'
    }
  },
  computed: {
    // 实际使用的容器高度，确保与主组件传入的高度一致
    actualContainerHeight() {
      return this.containerHeight
    },

    totalHeight() {
      return this.data.length * this.itemHeight
    },
    startIndex() {
      return Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize)
    },
    endIndex() {
      const visibleCount = Math.ceil(this.actualContainerHeight / this.itemHeight)
      return Math.min(this.data.length, this.startIndex + visibleCount + this.bufferSize * 2)
    },
    visibleItems() {
      return this.data.slice(this.startIndex, this.endIndex)
    },
    offsetTop() {
      return this.startIndex * this.itemHeight
    },
    offsetBottom() {
      return Math.max(0, (this.data.length - this.endIndex) * this.itemHeight)
    }
  },
  methods: {
    onScroll(e) {
      this.scrollTop = e.target.scrollTop
      this.$emit('scroll', {
        scrollTop: this.scrollTop,
        startIndex: this.startIndex,
        endIndex: this.endIndex
      })
    },
    handleSort(column) {
      if (!column.sortable) return
      if (this.sortColumn === column.key) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortColumn = column.key
        this.sortDirection = 'asc'
      }
      this.$emit('sort', { column: column.key, direction: this.sortDirection })
    },
    getColumnValue(item, key) {
      return key.split('.').reduce((obj, k) => obj && obj[k], item)
    },
    formatValue(val, format) {
      if (!format) return val
      if (format === 'date' && val) return new Date(val).toLocaleDateString()
      return val
    }
  }
}
</script>

<style scoped>
.better-virtual-scroll-table {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-size: 13px;
  border: 1px solid #e1e8ed;
  box-sizing: border-box;
}
.table-header {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e1e8ed;
  position: sticky;
  top: 0;
  z-index: 2;
}
.header-cell {
  height: 62px;
  line-height: 62px;
  font-weight: 600;
  user-select: none;
  border-right: 1px solid #e1e8ed;
  background: #f8fafc;
  white-space: nowrap;
  transition: background 0.2s;
}
.header-cell:last-child {
  border-right: none;
}
.header-cell.sortable {
  cursor: pointer;
}
.header-cell.sortable:hover {
  background: #e6f7ff;
}
.sort-icon {
  margin-left: 8px;
  color: #1890ff;
  font-weight: bold;
}
.table-body {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background: #fff;
}
.table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  background: #fff;
  transition: background 0.2s;
}
.table-row.row-even {
  background: #fff;
}
.table-row.row-odd {
  background: #f9fafb;
}
.table-row:hover {
  background: #f0f5ff;
}
.table-row.highlighted {
  background: #e6f7ff !important;
}
.table-cell {
  padding: 8px 12px;
  border-right: 1px solid #f0f0f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-cell:last-child {
  border-right: none;
}
.virtual-spacer {
  width: 100%;
  background: transparent;
}
/* 滚动条美化 */
.better-virtual-scroll-table ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.better-virtual-scroll-table ::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
.better-virtual-scroll-table ::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}
.better-virtual-scroll-table ::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}
</style>
