<template>
  <div class="filter-popover">
    <el-input
      v-model="searchText"
      :placeholder="placeholder"
      size="mini"
      clearable
      @input="handleSearch"
      @clear="handleClear"
      prefix-icon="el-icon-search"
    />
    <div v-if="options.length > 0" class="filter-options">
      <div class="filter-option-header">{{ optionsTitle }}:</div>
      <el-checkbox-group v-model="selectedValues" @change="handleChange">
        <div v-for="option in filteredOptions" :key="option.value" class="filter-option-item">
          <el-checkbox :label="option.value" :disabled="false">
            {{ option.label }}
          </el-checkbox>
        </div>
      </el-checkbox-group>
    </div>
    <div class="filter-actions">
      <el-button size="mini" @click="selectAll">全选</el-button>
      <el-button size="mini" @click="clearAll">清空</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FilterPopover',
  props: {
    // 筛选选项
    options: {
      type: Array,
      default: () => []
    },
    // 已选值
    value: {
      type: Array,
      default: () => []
    },
    // 搜索框占位符
    placeholder: {
      type: String,
      default: '搜索...'
    },
    // 选项标题
    optionsTitle: {
      type: String,
      default: '可选项'
    }
  },
  data() {
    return {
      searchText: '',
      selectedValues: this.value
    }
  },
  computed: {
    // 根据搜索文本过滤选项
    filteredOptions() {
      if (!this.searchText) return this.options
      const searchLower = this.searchText.toLowerCase()
      return this.options.filter(option =>
        option.label.toLowerCase().includes(searchLower) ||
        option.value.toLowerCase().includes(searchLower)
      )
    }
  },
  watch: {
    value: {
      handler(newVal) {
        this.selectedValues = newVal
      },
      deep: true
    }
  },
  methods: {
    // 处理搜索
    handleSearch() {
      this.$emit('search', this.searchText)
    },

    // 清除搜索
    handleClear() {
      this.searchText = ''
      this.$emit('search', '')
    },

    // 处理选择变化
    handleChange() {
      this.$emit('input', this.selectedValues)
      this.$emit('change', this.selectedValues)
    },

    // 全选
    selectAll() {
      this.selectedValues = this.options.map(option => option.value)
      this.handleChange()
    },

    // 清空
    clearAll() {
      this.selectedValues = []
      this.handleChange()
    }
  }
}
</script>

<style scoped>
.filter-popover {
  padding: 12px;
}

.filter-options {
  margin-top: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.filter-option-header {
  font-weight: bold;
  margin-bottom: 8px;
}

.filter-option-item {
  margin: 4px 0;
}

.filter-actions {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
}
</style>
