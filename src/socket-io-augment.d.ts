import 'socket.io';

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    joinedLynkupIds?: Set<string>;
    lynkFinderOn?: boolean;
    lynkDmConversationIds?: Set<string>;
  }
}
