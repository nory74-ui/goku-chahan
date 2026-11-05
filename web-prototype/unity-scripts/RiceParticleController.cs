using UnityEngine;

namespace ChahanGame
{
    /// <summary>
    /// 各米粒の物理シミュレーション状態
    /// </summary>
    public struct RiceGrainData
    {
        public Vector3 Position;
        public Vector3 Velocity;
        public Quaternion Rotation;
        public Vector3 AngularVelocity;
        public float CookState; // 0: 生米, 0.5: 卵コーティング, 1.0: 黄金パラパラ, 2.0: 焦げ
        public bool InLadle;
    }

    /// <summary>
    /// GPU Instancing を用いた大量米粒（500〜2,000粒）の軽量物理シミュレーション＆レンダラー
    /// 中華鍋の放物面（Paraboloid）との数学的衝突判定により超高速動作
    /// </summary>
    public class RiceParticleController : MonoBehaviour
    {
        [Header("Mesh & Rendering")]
        [SerializeField] private Mesh riceMesh;
        [SerializeField] private Material riceInstancedMaterial;
        [SerializeField] private int grainCount = 1000;

        [Header("Wok Geometry (放物面 z = a * (x^2 + y^2))")]
        [Tooltip("中華鍋の深さ・傾斜係数")]
        [SerializeField] private float wokCurvature = 0.8f;
        [Tooltip("鍋の縁の半径")]
        [SerializeField] private float wokRadius = 1.6f;

        [Header("Physics Parameters")]
        [SerializeField] private float gravity = 9.8f;
        [SerializeField] private float friction = 0.92f;
        [SerializeField] private float restitution = 0.25f; // 反発係数

        // 内部データ
        private RiceGrainData[] _grains;
        private Matrix4x4[] _matrices;
        private MaterialPropertyBlock _propertyBlock;
        private float[] _cookStates;

        private static readonly int CookStateId = Shader.PropertyToID("_CookState");

        private void Awake()
        {
            InitializeGrains();
        }

        private void InitializeGrains()
        {
            _grains = new RiceGrainData[grainCount];
            _matrices = new Matrix4x4[grainCount];
            _cookStates = new float[grainCount];
            _propertyBlock = new MaterialPropertyBlock();

            for (int i = 0; i < grainCount; i++)
            {
                // 鍋の底周辺にランダム配置
                Vector2 randomCircle = Random.insideUnitCircle * (wokRadius * 0.4f);
                float x = randomCircle.x;
                float y = randomCircle.y;
                float z = wokCurvature * (x * x + y * y);

                _grains[i] = new RiceGrainData
                {
                    Position = new Vector3(x, z, y), // Unity座標系 (Y-up)
                    Velocity = Vector3.zero,
                    Rotation = Random.rotation,
                    AngularVelocity = Random.insideUnitSphere * 5f,
                    CookState = 0.1f, // 初期状態
                    InLadle = false
                };

                _matrices[i] = Matrix4x4.TRS(_grains[i].Position, _grains[i].Rotation, Vector3.one * 0.08f);
                _cookStates[i] = _grains[i].CookState;
            }
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            SimulatePhysics(dt);
            RenderGrains();
        }

        /// <summary>
        /// 物理シミュレーション更新（数学的ボウル衝突）
        /// </summary>
        private void SimulatePhysics(float dt)
        {
            Vector3 gravVector = new Vector3(0, -gravity, 0);

            for (int i = 0; i < grainCount; i++)
            {
                ref var g = ref _grains[i];

                if (g.InLadle)
                {
                    // お玉に引き寄せられている状態
                    Vector3 target = new Vector3(0, 0.2f, 0) + Random.insideUnitSphere * 0.15f;
                    g.Position = Vector3.Lerp(g.Position, target, dt * 8f);
                    g.Velocity = Vector3.zero;
                }
                else
                {
                    // 重力加算
                    g.Velocity += gravVector * dt;
                    g.Position += g.Velocity * dt;

                    // 中華鍋の放物面ボウルとの衝突判定 (y = a * (x^2 + z^2))
                    float distSq = g.Position.x * g.Position.x + g.Position.z * g.Position.z;
                    float wokSurfaceY = wokCurvature * distSq;

                    if (g.Position.y < wokSurfaceY)
                    {
                        // 鍋底に接触
                        g.Position.y = wokSurfaceY;

                        // 法線ベクトルの計算: N = (-2ax, 1, -2az)
                        Vector3 normal = new Vector3(-2f * wokCurvature * g.Position.x, 1f, -2f * wokCurvature * g.Position.z).normalized;

                        // 衝突反発と滑り摩擦
                        float normalVel = Vector3.Dot(g.Velocity, normal);
                        if (normalVel < 0)
                        {
                            Vector3 tangentVel = g.Velocity - normal * normalVel;
                            g.Velocity = tangentVel * friction - normal * (normalVel * restitution);
                        }
                    }

                    // 鍋の縁（フチ）の拘束
                    if (distSq > (wokRadius * wokRadius))
                    {
                        Vector2 clampedXZ = new Vector2(g.Position.x, g.Position.z).normalized * wokRadius;
                        g.Position.x = clampedXZ.x;
                        g.Position.z = clampedXZ.y;
                        g.Velocity.x = -g.Velocity.x * 0.4f;
                        g.Velocity.z = -g.Velocity.z * 0.4f;
                    }
                }

                // 回転更新
                g.Rotation *= Quaternion.Euler(g.AngularVelocity * dt);

                // 行列更新
                _matrices[i] = Matrix4x4.TRS(g.Position, g.Rotation, Vector3.one * 0.08f);
                _cookStates[i] = g.CookState;
            }
        }

        /// <summary>
        /// 煽り（Toss）入力時のインパルス付与
        /// </summary>
        public void ApplyWokToss(TossEventData toss)
        {
            float baseLift = 4.2f * toss.Power;
            float pullForward = -1.2f * toss.Power; // 手前へ引き込む

            for (int i = 0; i < grainCount; i++)
            {
                ref var g = ref _grains[i];
                if (g.InLadle) continue;

                // 各粒にわずかな乱数を加えて自然に散らす
                float randomLift = Random.Range(-0.4f, 0.8f);
                Vector3 impulse = new Vector3(
                    Random.Range(-0.8f, 0.8f),
                    baseLift + randomLift,
                    pullForward + Random.Range(-0.5f, 0.5f)
                );

                g.Velocity += impulse;
                g.AngularVelocity += Random.insideUnitSphere * (toss.Power * 300f);
            }
        }

        /// <summary>
        /// 全米粒の調理状態（色）を一括更新
        /// </summary>
        public void UpdateCookStates(float stateValue)
        {
            for (int i = 0; i < grainCount; i++)
            {
                _grains[i].CookState = stateValue;
            }
        }

        /// <summary>
        /// お玉へのまとめ
        /// </summary>
        public void GatherIntoLadle()
        {
            for (int i = 0; i < grainCount; i++)
            {
                _grains[i].InLadle = true;
            }
        }

        private void RenderGrains()
        {
            if (riceMesh == null || riceInstancedMaterial == null) return;

            // 1,023個ずつバッチ描画（UnityのDrawMeshInstancedの最大制限）
            int remaining = grainCount;
            int offset = 0;

            while (remaining > 0)
            {
                int batchSize = Mathf.Min(remaining, 1000);
                Matrix4x4[] batchMatrices = new Matrix4x4[batchSize];
                System.Array.Copy(_matrices, offset, batchMatrices, 0, batchSize);

                float[] batchStates = new float[batchSize];
                System.Array.Copy(_cookStates, offset, batchStates, 0, batchSize);

                _propertyBlock.SetFloatArray(CookStateId, batchStates);

                Graphics.DrawMeshInstanced(
                    riceMesh,
                    0,
                    riceInstancedMaterial,
                    batchMatrices,
                    batchSize,
                    _propertyBlock
                );

                offset += batchSize;
                remaining -= batchSize;
            }
        }
    }
}
