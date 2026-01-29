import { useBlockUi } from '@/composables/useBlockUi';

export function useApiWrapper() {
  const { blockUi, unblockUi } = useBlockUi();

  /**
   * @param {Function} apiFunc - 실행할 비동기 함수
   * @param {Object} options - 추가 옵션 (성공/실패 콜백 등)
   */
  const withLoading = async (apiFunc, options = {}) => {
    try {
      blockUi();
      return await apiFunc();
    } catch (error) {
      console.error('API Error:', error);
      if (options.onError) options.onError(error);
      throw error; // 에러를 상위로 전파
    } finally {
      unblockUi();
    }
  };

  return { withLoading };
}
