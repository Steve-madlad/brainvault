import { configureStore } from "@reduxjs/toolkit";
import { summarizeApi } from "@/app/lib/summarize-api";

type RootStateShape = {
  [summarizeApi.reducerPath]: ReturnType<typeof summarizeApi.reducer>;
};

const rootReducer = (
  state: RootStateShape | undefined,
  action: Parameters<typeof summarizeApi.reducer>[1],
): RootStateShape => ({
  [summarizeApi.reducerPath]: summarizeApi.reducer(
    state?.[summarizeApi.reducerPath],
    action,
  ),
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(summarizeApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
