<script setup>
  import { onMounted, ref } from 'vue';

  import { deleteShortenUrlApi, getShortenUrlListApi, getShortenUrlStatisticApi, updateShortenUrlApi } from '@/api/admin';
  import { useApiWrapper } from '@/composables/useApiWrapper';
  import { useAppToast } from '@/composables/useAppToast';
  import { useBlockUi } from '@/composables/useBlockUi';
  import { getErrorMsg } from '@/utils/commonUtils';

  const { blockUi, unblockUi } = useBlockUi();
  const toast = useAppToast();
  const { withLoading } = useApiWrapper();

  // 통게 관련
  const todayRedirectCount = ref(0);
  const todayMostAccessIp = ref('x.x.x.x');
  const todayTop5Label = ref([]);
  const todayTop5Data = ref([]);
  const weekTop5Label = ref([]);
  const weekTop5Data = ref([]);
  const monthTop5Label = ref([]);
  const monthTop5Data = ref([]);
  const selectedPeriod = ref('today');
  const barData = ref(null);
  const barOptions = ref(null);

  // 통계 조회
  const getStatistic = async () => {
    const { code, data } = await getShortenUrlStatisticApi();
    if (code === 'S0000') {
      todayRedirectCount.value = data.todayRedirectCount;
      todayMostAccessIp.value = data.todayMostAccessIp;
      data.todayTop5.forEach((item) => {
        todayTop5Label.value.push(item.x);
        todayTop5Data.value.push(item.y);
      });
      data.weekTop5.forEach((item) => {
        weekTop5Label.value.push(item.x);
        weekTop5Data.value.push(item.y);
      });
      data.monthTop5.forEach((item) => {
        monthTop5Label.value.push(item.x);
        monthTop5Data.value.push(item.y);
      });
    }

    setChart('today');
  };

  // 차트 설정
  const setChart = (period) => {
    const target = {
      today: { label: todayTop5Label, data: todayTop5Data },
      week: { label: weekTop5Label, data: weekTop5Data },
      month: { label: monthTop5Label, data: monthTop5Data },
    }[period];

    if (!target || !target.label.value) return;

    selectedPeriod.value = period;

    const documentStyle = getComputedStyle(document.documentElement);
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    barData.value = {
      labels: target.label.value,
      datasets: [
        {
          label: 'Redirect Count',
          backgroundColor: documentStyle.getPropertyValue('--p-primary-400'),
          borderColor: documentStyle.getPropertyValue('--p-primary-400'),
          data: target.data.value,
        },
      ],
    };

    barOptions.value = {
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColorSecondary,
            font: {
              weight: 500,
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
        },
        y: {
          ticks: {
            color: textColorSecondary,
            stepSize: 10,
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false,
          },
        },
      },
    };
  };

  const isSelectedPeriod = (period) => selectedPeriod.value !== period;

  // 목록 관련
  const totalCount = ref(0);
  const shortenUrls = ref(null);
  const loading = ref(null);
  const shortenUrl = ref(null);
  const detailDialog = ref(false);
  const deleteDialog = ref(false);
  const searchWord = ref('');

  // 목록 조회
  const getList = async (isForced = false) => {
    const config = isForced ? { headers: { 'X-Forced-Primary': 'true' } } : {};

    const { code, data } = await getShortenUrlListApi(
      {
        start: 1,
        limit: 500,
        searchWord: searchWord.value,
      },
      config
    );
    if (code === 'S0000') {
      totalCount.value = data.totalCount;
      shortenUrls.value = data.list;
    }
  };

  // 상세 다이얼로그
  const showDetailDialog = (data) => {
    shortenUrl.value = { ...data };
    detailDialog.value = true;
  };

  // 수정
  const updateShortenUrl = async () => {
    const id = shortenUrl.value.id;

    await withLoading(async () => {
      const params = {
        shortenUri: shortenUrl.value.shortenUri,
        orgUrl: shortenUrl.value.orgUrl,
      };

      const { code, data } = await updateShortenUrlApi(id, params);
      if (code === 'S0000') {
        toast.success('수정 완료');
        detailDialog.value = false;
        await getList(true);
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };

  // splitButton model
  const getMenuItems = (data) => [
    {
      label: '삭제',
      icon: 'pi pi-times',
      command: () => {
        confirmDelete(data);
      },
    },
  ];

  // 삭제 다이얼로그
  const confirmDelete = (data) => {
    shortenUrl.value = data;
    deleteDialog.value = true;
  };

  // 삭제
  const deleteShortenUrl = async () => {
    const id = shortenUrl.value.id;

    await withLoading(async () => {
      const { code, data } = await deleteShortenUrlApi(id);
      if (code === 'S0000') {
        toast.success('삭제 완료');
        deleteDialog.value = false;
        await getList(true);
      } else {
        toast.error(getErrorMsg(code));
      }
    });
  };

  onMounted(async () => {
    blockUi();

    try {
      await getStatistic();
      await getList();
    } catch (error) {
      console.error('API Error:', error);
    } finally {
      unblockUi();
    }
  });
</script>

<template>
  <div class="flex flex-col gap-8 md:flex-row">
    <div class="md:w-1/3">
      <div class="card mb-0">
        <div class="mb-4 flex justify-between">
          <div>
            <span class="text-muted-color mb-4 block font-medium">Today</span>
            <div class="text-surface-900 dark:text-surface-0 text-xl font-medium">{{ todayRedirectCount }}</div>
          </div>
          <div class="rounded-border flex h-10 w-10 items-center justify-center bg-orange-100 dark:bg-orange-400/10">
            <i class="pi pi-chart-line text-xl! text-orange-500"></i>
          </div>
        </div>
        <span class="text-muted-color">Redirect Count</span>
      </div>
      <div class="card mb-0">
        <div class="mb-4 flex justify-between">
          <div>
            <span class="text-muted-color mb-4 block font-medium">Today</span>
            <div class="text-surface-900 dark:text-surface-0 text-xl font-medium">{{ todayMostAccessIp }}</div>
          </div>
          <div class="rounded-border flex h-10 w-10 items-center justify-center bg-orange-100 dark:bg-orange-400/10">
            <i class="pi pi-crown text-xl! text-orange-500"></i>
          </div>
        </div>
        <span class="text-muted-color">Most Access IP</span>
      </div>
    </div>
    <div class="md:w-2/3">
      <div class="card">
        <div class="mb-2 flex justify-between">
          <div class="text-xl font-semibold">Top5 URI</div>
          <div class="flex gap-2">
            <Button label="Today" :outlined="isSelectedPeriod('today')" @click="setChart('today')" />
            <Button label="Week" :outlined="isSelectedPeriod('week')" @click="setChart('week')" />
            <Button label="Month" :outlined="isSelectedPeriod('month')" @click="setChart('month')" />
          </div>
        </div>
        <Chart type="bar" :data="barData" :options="barOptions" />
      </div>
    </div>
  </div>
  <div class="mt-8 flex">
    <div class="card flex w-full flex-col gap-4">
      <DataTable :value="shortenUrls" :paginator="true" :rows="500" dataKey="id" :rowHover="true" :loading="loading" showGridlines stripedRows>
        <template #header>
          <div class="flex justify-between">
            <Tag severity="secondary">{{ totalCount }}</Tag>
            <IconField>
              <InputIcon>
                <i class="pi pi-search" />
              </InputIcon>
              <InputText v-model="searchWord" placeholder="검색" @keyup.enter="getList" />
            </IconField>
          </div>
        </template>
        <template #empty>No shortenUrl found.</template>
        <template #loading>Loading shortenUrl data. Please wait.</template>

        <Column field="shortenUri" header="shortenUri" class="min-w-48">
          <template #body="{ data }">
            <SplitButton :model="getMenuItems(data)" severity="contrast" text @click="showDetailDialog(data)" fluid>
              {{ data.shortenUri }}
            </SplitButton>
          </template>
        </Column>
        <Column field="orgUrl" header="orgUrl" class="min-w-48"></Column>
        <Column field="lastAccessDate" header="lastAccessDate" class="min-w-48">
          <template #body="{ data }">
            {{ data.lastAccessDate ?? '-' }}
          </template>
        </Column>
        <Column field="regDate" header="regDate" class="min-w-48">
          <template #body="{ data }">
            {{ data.regDate ?? '-' }}
          </template>
        </Column>
        <Column field="modDate" header="modDate" class="min-w-48">
          <template #body="{ data }">
            {{ data.modDate ?? '-' }}
          </template>
        </Column>
      </DataTable>
      <Dialog v-model:visible="detailDialog" class="w-112.5" header="상세" :modal="true">
        <div class="flex flex-col gap-6">
          <div>
            <label for="shortenUri" class="mb-3 block font-bold">shortenUri</label>
            <InputText id="shortenUri" v-model.trim="shortenUrl.shortenUri" required="true" autofocus :invalid="!shortenUrl.shortenUri" fluid />
            <small v-if="!shortenUrl.shortenUri" class="text-red-500">required.</small>
          </div>
          <div>
            <label for="orgUrl" class="mb-3 block font-bold">orgUrl</label>
            <Textarea id="orgUrl" v-model.trim="shortenUrl.orgUrl" required="true" autoResize :invalid="!shortenUrl.orgUrl" fluid />
            <small v-if="!shortenUrl.orgUrl" class="text-red-500">required.</small>
          </div>
        </div>
        <template #footer>
          <Button label="취소" icon="pi pi-times" text @click="detailDialog = false" />
          <Button label="수정" icon="pi pi-check" @click="updateShortenUrl" />
        </template>
      </Dialog>
      <Dialog v-model:visible="deleteDialog" class="w-112.5" header="확인" :modal="true">
        <div class="flex items-center gap-4">
          <i class="pi pi-exclamation-triangle text-3xl!" />
          <span v-if="shortenUrl" class="text-500 w-full truncate">
            삭제하시겠습니까?
            <br />
            <b :title="shortenUrl.orgUrl">{{ shortenUrl.orgUrl }}</b>
          </span>
        </div>
        <template #footer>
          <Button label="취소" icon="pi pi-times" text @click="deleteDialog = false" />
          <Button label="삭제" icon="pi pi-check" @click="deleteShortenUrl" />
        </template>
      </Dialog>
    </div>
  </div>
</template>
