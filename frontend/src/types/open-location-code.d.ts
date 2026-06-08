declare module "open-location-code" {
  class OpenLocationCode {
    encode(latitude: number, longitude: number, codeLength?: number): string;
  }
  export { OpenLocationCode };
}
