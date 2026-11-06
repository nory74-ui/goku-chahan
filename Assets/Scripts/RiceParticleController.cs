using UnityEngine;

namespace ChahanGame
{
    public enum IngredientType
    {
        Rice,
        Meat,
        Onion,
        Egg
    }

    public struct ParticleData
    {
        public IngredientType Type;
        public Vector3 Position;
        public Vector3 Velocity;
        public Quaternion Rotation;
        public Vector3 AngularVelocity;
        public float CookState;
        public bool InLadle;
        public bool IsActive;
        public float Scale;
    }

    /// <summary>
    /// Blender製のリアル3Dモデル群（米粒、乱切りチャーシュー、中空長ネギ、ふんわり炒り卵）を
    /// GPU Instancing で一括描画・シミュレーションするコントローラー
    /// </summary>
    public class RiceParticleController : MonoBehaviour
    {
        [Header("Blender FBX Meshes & Materials")]
        [SerializeField] private Mesh riceMesh;
        [SerializeField] private Material riceMaterial;

        [SerializeField] private Mesh meatMesh;
        [SerializeField] private Material meatMaterial;

        [SerializeField] private Mesh onionMesh;
        [SerializeField] private Material onionMaterial;

        [SerializeField] private Mesh eggMesh;
        [SerializeField] private Material eggMaterial;

        [Header("Counts")]
        [SerializeField] private int maxRiceCount = 800;
        [SerializeField] private int maxMeatCount = 28;
        [SerializeField] private int maxOnionCount = 36;
        [SerializeField] private int maxEggCount = 32;

        [Header("Wok Geometry")]
        [SerializeField] private float wokCurvature = 0.85f;
        [SerializeField] private float wokRadius = 1.6f;

        [Header("Physics")]
        [SerializeField] private float gravity = 9.8f;
        [SerializeField] private float friction = 0.90f;
        [SerializeField] private float restitution = 0.20f;

        private ParticleData[] _riceParticles;
        private ParticleData[] _meatParticles;
        private ParticleData[] _onionParticles;
        private ParticleData[] _eggParticles;

        private Matrix4x4[] _riceMatrices;
        private Matrix4x4[] _meatMatrices;
        private Matrix4x4[] _onionMatrices;
        private Matrix4x4[] _eggMatrices;

        private float[] _riceCookStates;
        private MaterialPropertyBlock _propertyBlock;
        private static readonly int CookStateId = Shader.PropertyToID("_CookState");

        private bool _riceSpawned = false;
        private bool _meatSpawned = false;
        private bool _onionSpawned = false;
        private bool _eggSpawned = false;

        private void Awake()
        {
            InitializeParticles();
        }

        private void InitializeParticles()
        {
            _propertyBlock = new MaterialPropertyBlock();

            // 1. 米粒 (800粒)
            _riceParticles = new ParticleData[maxRiceCount];
            _riceMatrices = new Matrix4x4[maxRiceCount];
            _riceCookStates = new float[maxRiceCount];

            for (int i = 0; i < maxRiceCount; i++)
            {
                Vector2 circle = Random.insideUnitCircle * (wokRadius * 0.40f);
                float y = wokCurvature * (circle.x * circle.x + circle.y * circle.y);

                _riceParticles[i] = new ParticleData
                {
                    Type = IngredientType.Rice,
                    Position = new Vector3(circle.x, y, circle.y),
                    Velocity = Vector3.zero,
                    Rotation = Random.rotation,
                    AngularVelocity = Random.insideUnitSphere * 4f,
                    CookState = 0.1f,
                    InLadle = false,
                    IsActive = false,
                    Scale = 0.085f
                };
                _riceMatrices[i] = Matrix4x4.identity;
                _riceCookStates[i] = 0.1f;
            }

            // 2. チャーシュー (28個)
            _meatParticles = new ParticleData[maxMeatCount];
            _meatMatrices = new Matrix4x4[maxMeatCount];
            for (int i = 0; i < maxMeatCount; i++)
            {
                _meatParticles[i] = new ParticleData
                {
                    Type = IngredientType.Meat,
                    Position = Vector3.zero,
                    Velocity = Vector3.zero,
                    Rotation = Random.rotation,
                    AngularVelocity = Random.insideUnitSphere * 3f,
                    InLadle = false,
                    IsActive = false,
                    Scale = 0.11f
                };
                _meatMatrices[i] = Matrix4x4.identity;
            }

            // 3. 長ネギ (36個)
            _onionParticles = new ParticleData[maxOnionCount];
            _onionMatrices = new Matrix4x4[maxOnionCount];
            for (int i = 0; i < maxOnionCount; i++)
            {
                _onionParticles[i] = new ParticleData
                {
                    Type = IngredientType.Onion,
                    Position = Vector3.zero,
                    Velocity = Vector3.zero,
                    Rotation = Random.rotation,
                    AngularVelocity = Random.insideUnitSphere * 4f,
                    InLadle = false,
                    IsActive = false,
                    Scale = 0.10f
                };
                _onionMatrices[i] = Matrix4x4.identity;
            }

            // 4. 炒り卵そぼろ (32個)
            _eggParticles = new ParticleData[maxEggCount];
            _eggMatrices = new Matrix4x4[maxEggCount];
            for (int i = 0; i < maxEggCount; i++)
            {
                _eggParticles[i] = new ParticleData
                {
                    Type = IngredientType.Egg,
                    Position = Vector3.zero,
                    Velocity = Vector3.zero,
                    Rotation = Random.rotation,
                    AngularVelocity = Random.insideUnitSphere * 4f,
                    InLadle = false,
                    IsActive = false,
                    Scale = 0.13f
                };
                _eggMatrices[i] = Matrix4x4.identity;
            }
        }

        public void SpawnEgg()
        {
            _eggSpawned = true;
            for (int i = 0; i < maxEggCount; i++)
            {
                Vector2 circle = Random.insideUnitCircle * (wokRadius * 0.35f);
                float y = wokCurvature * (circle.x * circle.x + circle.y * circle.y) + 0.15f;
                _eggParticles[i].Position = new Vector3(circle.x, y, circle.y);
                _eggParticles[i].Velocity = new Vector3(Random.Range(-0.3f, 0.3f), 0.8f, Random.Range(-0.3f, 0.3f));
                _eggParticles[i].IsActive = true;
            }
        }

        public void SpawnRice()
        {
            _riceSpawned = true;
            for (int i = 0; i < maxRiceCount; i++)
            {
                _riceParticles[i].IsActive = true;
                _riceParticles[i].Velocity = new Vector3(Random.Range(-0.4f, 0.4f), 1.0f, Random.Range(-0.4f, 0.4f));
            }
        }

        public void SpawnMeat()
        {
            _meatSpawned = true;
            for (int i = 0; i < maxMeatCount; i++)
            {
                Vector2 circle = Random.insideUnitCircle * (wokRadius * 0.45f);
                float y = wokCurvature * (circle.x * circle.x + circle.y * circle.y) + 0.35f;
                _meatParticles[i].Position = new Vector3(circle.x, y, circle.y);
                _meatParticles[i].Velocity = new Vector3(Random.Range(-0.4f, 0.4f), 1.2f, Random.Range(-0.4f, 0.4f));
                _meatParticles[i].IsActive = true;
            }
        }

        public void SpawnOnion()
        {
            _onionSpawned = true;
            for (int i = 0; i < maxOnionCount; i++)
            {
                Vector2 circle = Random.insideUnitCircle * (wokRadius * 0.45f);
                float y = wokCurvature * (circle.x * circle.x + circle.y * circle.y) + 0.35f;
                _onionParticles[i].Position = new Vector3(circle.x, y, circle.y);
                _onionParticles[i].Velocity = new Vector3(Random.Range(-0.4f, 0.4f), 1.2f, Random.Range(-0.4f, 0.4f));
                _onionParticles[i].IsActive = true;
            }
        }

        private void Update()
        {
            float dt = Time.deltaTime;

            if (_eggSpawned) SimulateGroup(_eggParticles, _eggMatrices, maxEggCount, dt, false);
            if (_riceSpawned) SimulateGroup(_riceParticles, _riceMatrices, maxRiceCount, dt, true);
            if (_meatSpawned) SimulateGroup(_meatParticles, _meatMatrices, maxMeatCount, dt, false);
            if (_onionSpawned) SimulateGroup(_onionParticles, _onionMatrices, maxOnionCount, dt, false);

            RenderAll();
        }

        private void SimulateGroup(ParticleData[] particles, Matrix4x4[] matrices, int count, float dt, bool updateCook)
        {
            Vector3 gravVector = new Vector3(0, -gravity, 0);

            for (int i = 0; i < count; i++)
            {
                ref var p = ref particles[i];
                if (!p.IsActive) continue;

                if (p.InLadle)
                {
                    Vector3 target = new Vector3(0, 0.22f, 0) + Random.insideUnitSphere * 0.16f;
                    p.Position = Vector3.Lerp(p.Position, target, dt * 7f);
                    p.Velocity = Vector3.zero;
                }
                else
                {
                    p.Velocity += gravVector * dt;
                    p.Position += p.Velocity * dt;

                    float distSq = p.Position.x * p.Position.x + p.Position.z * p.Position.z;
                    float surfaceY = wokCurvature * distSq;

                    if (p.Position.y < surfaceY)
                    {
                        p.Position.y = surfaceY;
                        Vector3 normal = new Vector3(-2f * wokCurvature * p.Position.x, 1f, -2f * wokCurvature * p.Position.z).normalized;
                        float normalVel = Vector3.Dot(p.Velocity, normal);
                        if (normalVel < 0)
                        {
                            Vector3 tangentVel = p.Velocity - normal * normalVel;
                            p.Velocity = tangentVel * friction - normal * (normalVel * restitution);
                        }
                    }

                    if (distSq > (wokRadius * wokRadius))
                    {
                        Vector2 clamped = new Vector2(p.Position.x, p.Position.z).normalized * wokRadius;
                        p.Position.x = clamped.x;
                        p.Position.z = clamped.y;
                        p.Velocity.x = -p.Velocity.x * 0.4f;
                        p.Velocity.z = -p.Velocity.z * 0.4f;
                    }
                }

                p.Rotation *= Quaternion.Euler(p.AngularVelocity * dt);
                matrices[i] = Matrix4x4.TRS(p.Position, p.Rotation, Vector3.one * p.Scale);

                if (updateCook)
                {
                    _riceCookStates[i] = p.CookState;
                }
            }
        }

        public void ApplyWokToss(TossEventData toss)
        {
            float baseLift = 4.2f * toss.Power;
            float pullForward = -1.2f * toss.Power;

            if (_eggSpawned) ApplyTossToGroup(_eggParticles, maxEggCount, baseLift * 0.92f, pullForward, toss.Power);
            if (_riceSpawned) ApplyTossToGroup(_riceParticles, maxRiceCount, baseLift, pullForward, toss.Power);
            if (_meatSpawned) ApplyTossToGroup(_meatParticles, maxMeatCount, baseLift * 0.95f, pullForward, toss.Power);
            if (_onionSpawned) ApplyTossToGroup(_onionParticles, maxOnionCount, baseLift * 1.05f, pullForward, toss.Power);
        }

        private void ApplyTossToGroup(ParticleData[] particles, int count, float baseLift, float pullForward, float power)
        {
            for (int i = 0; i < count; i++)
            {
                ref var p = ref particles[i];
                if (!p.IsActive || p.InLadle) continue;

                Vector3 impulse = new Vector3(
                    Random.Range(-0.7f, 0.7f),
                    baseLift + Random.Range(-0.4f, 0.7f),
                    pullForward + Random.Range(-0.4f, 0.4f)
                );
                p.Velocity += impulse;
                p.AngularVelocity += Random.insideUnitSphere * (power * 320f);
            }
        }

        public void UpdateCookStates(float stateValue)
        {
            for (int i = 0; i < maxRiceCount; i++)
            {
                _riceParticles[i].CookState = stateValue;
            }
        }

        public void GatherIntoLadle()
        {
            for (int i = 0; i < maxEggCount; i++) _eggParticles[i].InLadle = true;
            for (int i = 0; i < maxRiceCount; i++) _riceParticles[i].InLadle = true;
            for (int i = 0; i < maxMeatCount; i++) _meatParticles[i].InLadle = true;
            for (int i = 0; i < maxOnionCount; i++) _onionParticles[i].InLadle = true;
        }

        private void RenderAll()
        {
            if (_eggSpawned && eggMesh != null && eggMaterial != null)
            {
                Graphics.DrawMeshInstanced(eggMesh, 0, eggMaterial, _eggMatrices, maxEggCount);
            }
            if (_riceSpawned && riceMesh != null && riceMaterial != null)
            {
                _propertyBlock.SetFloatArray(CookStateId, _riceCookStates);
                Graphics.DrawMeshInstanced(riceMesh, 0, riceMaterial, _riceMatrices, maxRiceCount, _propertyBlock);
            }
            if (_meatSpawned && meatMesh != null && meatMaterial != null)
            {
                Graphics.DrawMeshInstanced(meatMesh, 0, meatMaterial, _meatMatrices, maxMeatCount);
            }
            if (_onionSpawned && onionMesh != null && onionMaterial != null)
            {
                Graphics.DrawMeshInstanced(onionMesh, 0, onionMaterial, _onionMatrices, maxOnionCount);
            }
        }
    }
}
