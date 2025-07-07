<template>
  <div class="holiday-test-view">
    <div class="test-container">
      <h2>节假日功能测试</h2>

      <!-- 功能测试区域 -->
      <div class="test-sections">
        <!-- 节假日服务测试 -->
        <div class="test-section">
          <h3>节假日服务测试</h3>
          <div class="test-controls">
            <el-input
              v-model="testYear"
              placeholder="输入年份"
              style="width: 120px; margin-right: 10px;"
              type="number"
            />
            <el-button @click="testHolidayService" type="primary" :loading="loadingHolidays">
              获取节假日数据
            </el-button>
            <el-button @click="clearHolidayCache" type="warning">
              清除缓存
            </el-button>
          </div>

          <div v-if="holidayResults.length > 0" class="holiday-results">
            <h4>{{ testYear }}年节假日数据 ({{ holidayResults.length }}个)</h4>
            <div class="holiday-list">
              <div
                v-for="holiday in holidayResults"
                :key="holiday.date"
                class="holiday-item"
                :class="{ 'is-default': holiday.isDefault }"
              >
                <span class="holiday-date">{{ holiday.date }}</span>
                <span class="holiday-name">{{ holiday.name }}</span>
                <span v-if="holiday.isDefault" class="default-tag">默认</span>
              </div>
            </div>
          </div>

          <div v-if="apiError" class="error-message">
            <p>API错误: {{ apiError }}</p>
          </div>
        </div>

        <!-- 时间轴样式测试 -->
        <div class="test-section">
          <h3>时间轴样式测试</h3>
          <div class="timeline-demo">
            <!-- 模拟时间轴样式 -->
            <div class="demo-timeline">
              <div class="demo-cell">普通日期</div>
              <div class="demo-cell is-saturday">周六 (蓝色)</div>
              <div class="demo-cell is-sunday">周日 (红色)</div>
              <div class="demo-cell is-holiday">节假日 (金色)</div>
              <div class="demo-cell is-today">今天</div>
              <div class="demo-cell is-today is-saturday">今天+周六</div>
              <div class="demo-cell is-today is-sunday">今天+周日</div>
              <div class="demo-cell is-holiday is-today">今天+节假日</div>
            </div>
          </div>
        </div>

        <!-- 甘特图预览 -->
        <div class="test-section">
          <h3>甘特图时间轴预览</h3>
          <div class="gantt-preview">
            <GanttTimeline
              :view-mode="viewMode"
              :start-date="previewStartDate"
              :end-date="previewEndDate"
              :zoom-level="1"
              :pan-offset="0"
              :container-width="800"
              ref="previewTimeline"
            />
          </div>

          <div class="preview-controls">
            <el-radio-group v-model="viewMode" @change="handleViewModeChange">
              <el-radio-button label="day">日视图</el-radio-button>
              <el-radio-button label="month">月视图</el-radio-button>
              <el-radio-button label="year">年视图</el-radio-button>
            </el-radio-group>

            <el-date-picker
              v-model="previewDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              @change="handleDateRangeChange"
              style="margin-left: 10px;"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import holidayService from '@/services/holidayService'
import GanttTimeline from '@/components/GanttTimeline.vue'

export default {
  name: 'HolidayTestView',
  components: {
    GanttTimeline
  },
  data() {
    return {
      // 节假日服务测试
      testYear: new Date().getFullYear(),
      holidayResults: [],
      loadingHolidays: false,
      apiError: '',

      // 时间轴预览
      viewMode: 'month',
      previewDateRange: [
        new Date(new Date().getFullYear(), 0, 1), // 今年1月1日
        new Date(new Date().getFullYear(), 11, 31) // 今年12月31日
      ]
    }
  },

  computed: {
    previewStartDate() {
      return moment(this.previewDateRange[0])
    },

    previewEndDate() {
      return moment(this.previewDateRange[1])
    }
  },

  methods: {
    // 测试节假日服务
    async testHolidayService() {
      this.loadingHolidays = true
      this.apiError = ''
      this.holidayResults = []

      try {
        console.log(`开始测试${this.testYear}年节假日数据获取...`)
        const holidays = await holidayService.getHolidaysForYear(this.testYear)

        this.holidayResults = holidays.sort((a, b) =>
          moment(a.date).diff(moment(b.date))
        )

        console.log(`成功获取${holidays.length}个节假日:`, holidays)

        this.$message.success(`成功获取${holidays.length}个节假日数据`)
      } catch (error) {
        console.error('节假日服务测试失败:', error)
        this.apiError = error.message || '未知错误'
        this.$message.error(`节假日数据获取失败: ${  this.apiError}`)
      } finally {
        this.loadingHolidays = false
      }
    },

    // 清除节假日缓存
    clearHolidayCache() {
      holidayService.clearCache()
      this.holidayResults = []
      this.apiError = ''
      this.$message.info('节假日缓存已清除')
    },

    // 处理视图模式变化
    handleViewModeChange() {
      this.$nextTick(() => {
        if (this.$refs.previewTimeline) {
          this.$refs.previewTimeline.updateTimelineRange(
            this.previewStartDate,
            this.previewEndDate
          )
        }
      })
    },

    // 处理日期范围变化
    handleDateRangeChange() {
      this.$nextTick(() => {
        if (this.$refs.previewTimeline) {
          this.$refs.previewTimeline.updateTimelineRange(
            this.previewStartDate,
            this.previewEndDate
          )
        }
      })
    },

    // 初始化测试
    async initTest() {
      // 自动测试当前年份的节假日
      await this.testHolidayService()
    }
  },

  mounted() {
    this.initTest()
  }
}
</script>

<style scoped>
.holiday-test-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.test-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.test-sections {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.test-section {
  border: 1px solid #e1e8ed;
  border-radius: 6px;
  padding: 20px;
  background: #fafafa;
}

.test-section h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.test-controls {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.holiday-results {
  margin-top: 20px;
}

.holiday-results h4 {
  margin-bottom: 12px;
  color: #374151;
  font-size: 16px;
}

.holiday-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.holiday-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.holiday-item.is-default {
  background: #fef3c7;
  border-color: #f59e0b;
}

.holiday-date {
  font-weight: 600;
  color: #374151;
  margin-right: 12px;
  min-width: 80px;
}

.holiday-name {
  color: #6b7280;
  flex: 1;
}

.default-tag {
  background: #f59e0b;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 8px;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  padding: 12px;
  margin-top: 16px;
}

.error-message p {
  color: #dc2626;
  margin: 0;
}

/* 时间轴样式演示 */
.timeline-demo {
  margin-top: 16px;
}

.demo-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: white;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.demo-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  min-width: 80px;
  padding: 0 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  color: #374151;
  font-weight: 500;
  position: relative;
}

/* 复制时间轴样式 */
.demo-cell.is-saturday {
  background: rgba(59, 130, 246, 0.12) !important;
  color: #2563eb !important;
  font-weight: 600;
  border-left: 2px solid #3b82f6;
}

.demo-cell.is-sunday {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #dc2626 !important;
  font-weight: 600;
  border-left: 2px solid #ef4444;
}

.demo-cell.is-holiday {
  background: rgba(245, 158, 11, 0.15) !important;
  color: #d97706 !important;
  font-weight: 700;
  border-left: 3px solid #f59e0b;
  position: relative;
}

.demo-cell.is-holiday::after {
  content: '🎉';
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 8px;
  line-height: 1;
}

.demo-cell.is-today {
  background: rgba(74, 144, 226, 0.08) !important;
  color: #4a90e2 !important;
  font-weight: 700;
  border: 2px solid #4a90e2;
}

.demo-cell.is-today.is-saturday {
  background: linear-gradient(135deg,
    rgba(74, 144, 226, 0.15) 0%,
    rgba(59, 130, 246, 0.12) 100%) !important;
  box-shadow: inset 0 0 0 2px #4a90e2;
}

.demo-cell.is-today.is-sunday {
  background: linear-gradient(135deg,
    rgba(74, 144, 226, 0.12) 0%,
    rgba(239, 68, 68, 0.12) 100%) !important;
  box-shadow: inset 0 0 0 2px #4a90e2;
}

.demo-cell.is-holiday.is-today {
  background: linear-gradient(135deg,
    rgba(245, 158, 11, 0.2) 0%,
    rgba(74, 144, 226, 0.1) 100%) !important;
  box-shadow: inset 0 0 0 2px #f59e0b, inset 0 0 0 4px rgba(74, 144, 226, 0.3);
}

/* 甘特图预览 */
.gantt-preview {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  overflow: hidden;
  margin-bottom: 16px;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .holiday-list {
    grid-template-columns: 1fr;
  }

  .demo-timeline {
    flex-direction: column;
  }

  .demo-cell {
    width: 100%;
  }

  .preview-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
