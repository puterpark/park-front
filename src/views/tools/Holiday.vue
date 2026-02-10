<script setup>
  import { onMounted, watchEffect } from 'vue';
  import { createCalendar, createViewMonthGrid } from '@schedule-x/calendar';
  import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
  import { createEventModalPlugin } from '@schedule-x/event-modal';
  import { createEventsServicePlugin } from '@schedule-x/events-service';
  import { ScheduleXCalendar } from '@schedule-x/vue';
  import axios from 'axios';
  import dayjs from 'dayjs';
  import 'temporal-polyfill/global';
  import { useAppToast } from '@/composables/useAppToast';
  import { useBlockUi } from '@/composables/useBlockUi';
  import { useSeo } from '@/composables/useSeo';
  import { useLayoutStore } from '@/stores/useLayoutStore';
  import { getErrorMsg } from '@/utils/commonUtils';
  import '@schedule-x/theme-default/dist/index.css';

  useSeo({
    title: 'Holiday',
    description: '대한민국의 공휴일을 확인해 보세요.',
    keywords: '대한민국의 공휴일, 대한민국, 공휴일, holiday in korea, holiday, korea',
  });

  const layoutStore = useLayoutStore();
  const toast = useAppToast();
  const { blockUi, unblockUi } = useBlockUi();

  const eventModal = createEventModalPlugin();
  const eventsServicePlugin = createEventsServicePlugin();
  const calendarControls = createCalendarControlsPlugin();

  const loadedYears = new Set();
  const calendarApp = createCalendar({
    locale: 'ko-KR',
    timezone: 'Asia/Seoul',
    firstDayOfWeek: 7,
    views: [createViewMonthGrid()],
    calendars: {
      holiday: {
        colorName: 'holiday',
        lightColors: {
          main: 'var(--p-red-700)',
          container: 'var(--p-red-100)',
          onContainer: 'var(--p-red-700)',
        },
        darkColors: {
          main: 'var(--p-red-300)',
          container: 'color-mix(in srgb, var(--p-orange-500), transparent 84%)',
          onContainer: 'var(--p-red-300)',
        },
      },
    },
    plugins: [eventModal, eventsServicePlugin, calendarControls],
    callbacks: {
      onRangeUpdate(range) {
        const startYear = range.start.year;
        const endYear = range.end.year;

        if (!loadedYears.has(startYear)) {
          getHolidays(startYear);
        }

        if (endYear !== startYear && !loadedYears.has(endYear)) {
          getHolidays(endYear);
        }
      },
    },
  });

  const getDateRange = async () => {
    const response = await axios.get('https://holiday-api.puter.us/holidays/years');
    const data = response.data;

    calendarControls.setMinDate(Temporal.PlainDate.from(`${data.range.from}-01-01`));
    calendarControls.setMaxDate(Temporal.PlainDate.from(`${data.range.to}-12-31`));
  };

  const getHolidays = async (year) => {
    if (loadedYears.has(year)) {
      return;
    }

    const response = await axios.get(`https://holiday-api.puter.us/holidays?year=${year}`);
    const data = response.data;

    data.holidays.forEach((holiday) => {
      eventsServicePlugin.add({
        calendarId: 'holiday',
        id: holiday.date,
        title: holiday.name,
        start: Temporal.PlainDate.from(holiday.date),
        end: Temporal.PlainDate.from(holiday.date),
      });
    });

    loadedYears.add(year);
  };

  onMounted(async () => {
    blockUi();

    try {
      await getDateRange();
      await getHolidays(dayjs().year());
    } catch (error) {
      console.error('API Error:', error);
      toast.error(getErrorMsg());
    } finally {
      unblockUi();
    }
  });

  watchEffect(() => {
    calendarApp.setTheme(layoutStore.isDarkTheme ? 'dark' : 'light');
  });
</script>

<template>
  <div class="flex">
    <div class="card flex w-full flex-col gap-4">
      <div class="text-xl font-semibold">Holiday</div>
      <div>
        <ScheduleXCalendar :calendar-app="calendarApp" />
      </div>
    </div>
  </div>
</template>

<style scoped>
  .sx-vue-calendar-wrapper {
    max-width: 100vw;
    height: 700px;
    max-height: 90vh;
  }
</style>
