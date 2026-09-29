export interface SeatRejection {
  seatId: string;
  code: string;
}

export class SeatCommandRejected extends Error {
  constructor(readonly rejections: SeatRejection[]) {
    super(
      `Rejected: ${rejections.map((r) => `${r.seatId} (${r.code})`).join(', ')}`,
    );
    this.name = 'SeatCommandRejected';
  }
}
