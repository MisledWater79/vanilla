import { Chunk, TerrainGenerator } from "@serenityjs/core";

class OverworldGenerator extends TerrainGenerator {
  public static readonly identifier = "overworld";

  public apply(cx: number, cz: number): Chunk {
    // Create a new chunk and set it as not ready
    const chunk = new Chunk(cx, cz, this.dimension.type);
    chunk.ready = false;

    // Hand the chunk to the worker
    this.handoff(chunk);

    // Return the chunk
    return chunk;
  }
}

export { OverworldGenerator };