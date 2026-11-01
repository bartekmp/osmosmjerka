import { renderHook } from "@testing-library/react";
import apiClient from "@shared/utils/apiClient";
import { useAdminApi } from "../useAdminApi";

jest.mock("@shared/utils/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  },
}));

jest.mock("../../../../../hooks/useDebounce", () => ({
  useDebouncedApiCall: jest.fn(() => ({
    call: jest.fn(),
    isLoading: false,
    showRateLimit: false,
  })),
}));

const setters = () => ({
  setRows: jest.fn(),
  setTotalRows: jest.fn(),
  setDashboard: jest.fn(),
  setError: jest.fn(),
  setToken: jest.fn(),
  setIsLogged: jest.fn(),
});

describe("useAdminApi clearDb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    apiClient.delete.mockResolvedValue({ data: {} });
  });

  it("sends the selected language set id, which the backend requires", async () => {
    const { result } = renderHook(() => useAdminApi(setters()));

    await result.current.clearDb(jest.fn(), 7);

    expect(apiClient.delete).toHaveBeenCalledWith(
      "/admin/clear?language_set_id=7",
    );
  });

  it("does not call the API when no language set is selected", async () => {
    const props = setters();
    const { result } = renderHook(() => useAdminApi(props));

    await result.current.clearDb(jest.fn(), null);

    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(props.setError).toHaveBeenCalled();
  });

  it("does nothing when the confirmation is declined", async () => {
    window.confirm = jest.fn(() => false);
    const { result } = renderHook(() => useAdminApi(setters()));

    await result.current.clearDb(jest.fn(), 7);

    expect(apiClient.delete).not.toHaveBeenCalled();
  });
});
