import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme-context";
import { ChatProvider } from "@/lib/chat-context";
import { queryClient } from "@/lib/queryClient";
import { UserStateProvider } from "@/lib/user-state-context";
import ChatPage from "@/pages/chat";

const qc = queryClient || new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <UserStateProvider>
          <ChatProvider>
            <ChatPage />
          </ChatProvider>
        </UserStateProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
