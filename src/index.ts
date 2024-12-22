import {
  Astar,
  BlockIdentifier,
  BlockPermutation,
  InternalProvider,
  LevelDBProvider,
  Node,
  Player,
  WorldEvent,
  WorldProperties
} from "@serenityjs/core";
import { Plugin, PluginEvents } from "@serenityjs/plugins";
import { DimensionType, Vector3f } from "@serenityjs/protocol";

import { WalkEvaluator } from "./mob";
import { OverworldGenerator } from "./world";

const VanillaWorldProperties: WorldProperties = {
  identifier: "vanilla",
  seed: Math.floor(Math.random() * 2 ** 32),
  saveInterval: 5,
  dimensions: [
    {
      identifier: "overworld",
      type: DimensionType.Overworld,
      generator: "overworld",
      viewDistance: 5,
      simulationDistance: 10,
      spawnPosition: [0, 32767, 0]
    },
    // {
    //   identifier: "nether",
    //   type: DimensionType.Nether,
    //   generator: "overworld",
    //   viewDistance: 10,
    //   simulationDistance: 10,
    //   spawnPosition: [0, 32767, 0]
    // },
    // {
    //   identifier: "end",
    //   type: DimensionType.End,
    //   generator: "overworld",
    //   viewDistance: 10,
    //   simulationDistance: 10,
    //   spawnPosition: [0, 32767, 0]
    // }
  ]
};

class VanillaPlugin extends Plugin implements PluginEvents {
  public constructor() {
    super("vanilla", "1.0.0");
  }

  public onInitialize(): void  {
    this.serenity.registerGenerator(OverworldGenerator);
    this.serenity.registerProvider(InternalProvider, { path: "./worlds" });
    let vanillaWorld = InternalProvider.create(this.serenity, { path: "./worlds" }, VanillaWorldProperties);
    this.serenity.registerWorld(vanillaWorld);
  }

  public onStartUp(plugin: Plugin): void {
    plugin.serenity.worlds.forEach((world) => {
      world.after(WorldEvent.PlayerJoin, (args) => {
        let p = args.player;
        p.teleport(new Vector3f(0, 80, 0));
        p.gamemode = 1;
      })
      world.commands.register("testing", "Testing command", ({ origin }) => {
        if (!(origin instanceof Player)) return;
        const evaluator = new WalkEvaluator(origin);
        const pathfinder = new Astar(evaluator);
        const start = origin.position.floor().subtract(new Vector3f(0, 1, 0));
        const end = start.add(
          new Vector3f(10, 2, 0)
        ); /* this.randomizePosition(start, 3); */

        origin.dimension
          .getBlock(start.subtract({ x: 0, y: 1, z: 0 }))
          .setPermutation(BlockPermutation.resolve(BlockIdentifier.Bedrock));
        console.log(end);
        origin.dimension
          .getBlock(end.add(new Vector3f(0, 2, 0)))
          .setPermutation(BlockPermutation.resolve(BlockIdentifier.GoldBlock));
        const startT = performance.now();

        const path = pathfinder.findPath(new Node(start), new Node(end), 40);

        console.log(`Path found in ${performance.now() - startT}ms`);
        for (const node of path) {
          const block = origin.dimension.getBlock(node);
          block.setPermutation(
            BlockPermutation.resolve(BlockIdentifier.DiamondBlock)
          );
        }
      });
    });
  }

  private randomizePosition(base: Vector3f, max: number): Vector3f {
    const randomX = Math.floor(Math.random() * (max - base.x + 1)) + base.x;
    const randomZ = Math.floor(Math.random() * (max - base.z + 1)) + base.z;
    return new Vector3f(randomX, base.y + 1, randomZ);
  }
}

export default new VanillaPlugin();
