import { DimensionType, Vector3f } from "@serenityjs/protocol";

import { BlockIdentifier, BlockPermutation, Chunk, TerrainGenerator, TerrainGeneratorProperties, TerrainWorker, Worker } from "@serenityjs/core";

import { OverworldGenerator } from "./generator";
import { Simplex } from "../../../util/noise";
import { factor, jaged, offset, Spline } from "./splines";

@Worker(OverworldGenerator)
class OverworldWorker extends TerrainWorker {
  public static readonly path = __filename;

	public readonly solNoise: Simplex; //  Solid Noise
	public readonly cavNoise: Simplex; //  Cave Noise

	public readonly tempNoise: Simplex; // Temperature Noise
	public readonly humNoise: Simplex; //  Humidity Noise

	public readonly weiNoise: Simplex; //  Weirdness Noise
	public readonly conNoise: Simplex; //  Continentalness Noise
	public readonly eroNoise: Simplex; //  Erosion Noise

	public readonly bedrock = BlockPermutation.resolve(BlockIdentifier.Bedrock);
	public readonly stone = BlockPermutation.resolve(BlockIdentifier.Stone);
	public readonly dirt = BlockPermutation.resolve(BlockIdentifier.Dirt);
	public readonly sand = BlockPermutation.resolve(BlockIdentifier.Sand);
	public readonly gravel = BlockPermutation.resolve(BlockIdentifier.Gravel);
	public readonly grass = BlockPermutation.resolve(BlockIdentifier.GrassBlock);
	public readonly water = BlockPermutation.resolve(BlockIdentifier.Water);
	public readonly lava = BlockPermutation.resolve(BlockIdentifier.Lava);

  public constructor(generator: typeof TerrainGenerator, properties: TerrainGeneratorProperties) {
		super(generator, properties);
		Simplex.currentSeed = this.properties.seed;

		this.solNoise = new Simplex({
			distrib: 1,
			scale: 0.03,
			octaves: 2,
			amplitude: 0.8,
			seed: this.properties.seed
		});

		this.cavNoise = new Simplex({
			distrib: 1,
			scale: 0.03,
			octaves: 2,
			amplitude: 0.8,
			seed: this.properties.seed
		});

		this.tempNoise = new Simplex({
			distrib: 1,
			scale: 0.04,
			octaves: 2,
			amplitude: 0.8,
			seed: this.properties.seed
		});

		this.humNoise = new Simplex({
			distrib: 1,
			scale: 0.04,
			octaves: 2,
			amplitude: 0.8,
			seed: this.properties.seed
		});

		this.weiNoise = new Simplex({
			distrib: 1,
			scale: 0.0015,
			octaves: 6,
			amplitude: 1,
			seed: this.properties.seed
		});

		this.conNoise = new Simplex({
			distrib: 1,
			scale: 0.001,
			octaves: 6,
			amplitude: 0.7,
			seed: this.properties.seed
		});

		this.eroNoise = new Simplex({
			distrib: 1,
			scale: 0.001,
			octaves: 6,
			amplitude: 1,
			seed: this.properties.seed
		});
  }

  private linearInturp(
		x: number,
		xm: number,
		xM: number,
		ym: number,
		yM: number
	) {
		return ym + ((x - xm) * (yM - ym)) / (xM - xm);
	}

	/*
	 * TODO: ? Use a more rounder spline,
	 * right now it's just a straight line to each point,
	 * no curve/smoothness at the moment.
	 */
	public spline(value: number, points: Array<Array<number>>): number {
		for (let index = 0; index < points.length - 1; index++) {
			const [x1, y1] = points[index] ?? [0, 0];
			const [x2, y2] = points[index + 1] ?? [0, 0];

			if (value >= (x1 ?? 0) && value <= (x2 ?? 0))
				return this.linearInturp(value, x1 ?? 0, x2 ?? 0, y1 ?? 0, y2 ?? 0);
		}

		return 0;
	}

	public cubicSpline(
		x: number,
		points: Array<number>,
		values: Array<number>,
		derivatives: Array<number>
	): number {
		//@ts-ignore
		// if (x < points[0] || x > points.at(-1)) {
		// 	throw new Error(
		// 		`Value to interpolate is outside the range of the spline. Value: ${x}, Range: ${points[0]} | ${points.at(-1)}`
		// 	);
		// }
		if (x < points[0]) x = points[0];
		//@ts-ignore
		if (x > points.at(-1)) x = points.at(-1);

		function h(index: number): number {
			//@ts-ignore
			return points[index + 1] - points[index];
		}

		function a(index: number): number {
			//@ts-ignore
			return values[index];
		}

		function b(index: number): number {
			//@ts-ignore
			return derivatives[index];
		}

		function c(index: number): number {
			return (
				//@ts-ignore
				(3 / Math.pow(h(index), 2)) * (values[index + 1] - values[index]) -
				//@ts-ignore
				(derivatives[index + 1] + 2 * derivatives[index]) / h(index)
			);
		}

		function d(index: number): number {
			//@ts-ignore
			return (
				//@ts-ignore
				(-2 / Math.pow(h(index), 3)) * (values[index + 1] - values[index]) +
				//@ts-ignore
				(derivatives[index + 1] + derivatives[index]) / Math.pow(h(index), 2)
			);
		}

		let index = 0;
		//@ts-ignore
		while (index < points.length - 1 && x > points[index + 1]) {
			index++;
		}

		//@ts-ignore
		const dx = x - points[index];
		return (
			a(index) +
			b(index) * dx +
			c(index) * Math.pow(dx, 2) +
			d(index) * Math.pow(dx, 3)
		);
	}

	public getSplineVal(
		con: number,
		ero: number,
		pav: number,
		spline: Spline
	): number {
		let cord = 0;
		switch (spline.coordinate) {
			case "minecraft:overworld/continents": {
				cord = con;
				break;
			}
			case "minecraft:overworld/erosion": {
				cord = ero;
				break;
			}
			case "minecraft:overworld/ridges_folded": {
				cord = pav;
				break;
			}
		}
		const points = new Array<number>();
		const values = new Array<number>();
		const derivatives = new Array<number>();
		for (const p of spline.points) {
			points.push(p.location);
			derivatives.push(p.derivative);
			if (typeof p.value == "number") values.push(p?.value);
			else values.push(this.getSplineVal(con, ero, pav, p?.value));
		}
		const s = this.cubicSpline(cord, points, values, derivatives);
		return s;
	}

	//FOR DEBUG
	public getHeight(pos: Vector3f) {
		const con = this.conNoise.noise(
			Number(pos.x.toFixed(0)),
			Number(pos.z.toFixed(0))
		);
		const ero = this.eroNoise.noise(
			Number(pos.x.toFixed(0)),
			Number(pos.z.toFixed(0))
		);
		const wei = this.weiNoise.noise(
			Number(pos.x.toFixed(0)),
			Number(pos.z.toFixed(0))
		);
		const pav = 1 - Math.abs(3 * Math.abs(wei) - 2);

		//flat_cache(cache_2d((("minecraft:blend_offset" * (1 + (-1 * cache_once("minecraft:blend_alpha")))) + ((-0.5037500262260437 + n) * cache_once("minecraft:blend_alpha")))))
		const n = this.getSplineVal(con, ero, pav, offset);

		const h = this.linearInturp(n, -1.5, 1.5, -64, 320);
		return h;
	}

  public apply(cx: number, cz: number, type: DimensionType): Chunk {
    const chunk = new Chunk(cx, cz, type);

		for (let x = 0; x < 16; x++) {
			for (let z = 0; z < 16; z++) {
				chunk.setPermutation({x, y: 0, z}, this.bedrock, false);
				//continue;
				const con = this.conNoise.noise(chunk.x * 16 + x, chunk.z * 16 + z);
				const ero = this.eroNoise.noise(chunk.x * 16 + x, chunk.z * 16 + z);
				const wei = this.weiNoise.noise(chunk.x * 16 + x, chunk.z * 16 + z);
				const pav = 1 - Math.abs(3 * Math.abs(wei) - 2);
				const o =
					this.getSplineVal(con, ero, pav, offset) - 0.503_750_026_226_043_7;
				const d = this.linearInturp(o, -1.5, 1.5, -64, 320);
				const f = this.getSplineVal(con, ero, pav, factor);
				const index = this.getSplineVal(con, ero, pav, jaged);

				const n = d * f - 0.703_125;

				const h = d;
				for (let index = 0; index < h; index++) {
					if (index > 255) break;
					chunk.setPermutation({x, y: index, z}, this.stone, false);
					if (index >= h - 3) {
						if (h >= 64.545) {
							chunk.setPermutation({x, y: index, z}, this.dirt);
							if (index >= h - 1) chunk.setPermutation({x, y: index, z}, this.grass);
						} else {
							if (h >= 55.55) {
								chunk.setPermutation({x, y: index, z}, this.sand);
							} else {
								chunk.setPermutation({x, y: index, z}, this.gravel);
							}
						}
					}
				}
				// lava 55 so 56
				// if (h < 63) {
				// 	for (let index = h + 1; index < 63; index++) {
				// 		chunk.setPermutation(x, index, z, this.water);
				// 	}
				// }
			}
		}

		// Lava & Bedrock.
		// for (let x = 0; x < 16; x++) {
		// 	for (let z = 0; z < 16; z++) {
		// 		for (let y = 0; y < 5; y++) {
		// 			if (chunk.getPermutation(x, y, z) == this.air && y < -54)
		// 			chunk.setPermutation(x, y, z, this.lava);
		// 			switch (y) {
		// 				case 4: {
		// 					if (
		// 						this.solNoise.noise(
		// 							(chunk.x * 16 + x) * 64,
		// 							(chunk.z * 16 + z) * 64,
		// 							y
		// 						) >= 0.3
		// 					)
		// 						chunk.setPermutation(x, y, z, this.bedrock, false);
		// 					break;
		// 				}
		// 				case 3: {
		// 					if (
		// 						this.solNoise.noise(
		// 							(chunk.x * 16 + x) * 32,
		// 							(chunk.z * 16 + z) * 32,
		// 							y
		// 						) >= 0
		// 					)
		// 						chunk.setPermutation(x, y, z, this.bedrock, false);
		// 					break;
		// 				}
		// 				case 2: {
		// 					if (
		// 						this.solNoise.noise(
		// 							(chunk.x * 16 + x) * 16,
		// 							(chunk.z * 16 + z) * 16,
		// 							y
		// 						) >= -0.3
		// 					)
		// 						chunk.setPermutation(x, y, z, this.bedrock, false);
		// 					break;
		// 				}
		// 			}
		// 		}

		// 		chunk.setPermutation(x, 1, z, this.bedrock, false);
		// 		chunk.setPermutation(x, 0, z, this.bedrock, false);
		// 	}
		// }

		return chunk;
  }
}

export { OverworldWorker };