import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text, TextInput } from 'react-native-paper';
import { BottomSheet } from '../../components/BottomSheet';
import { CalendarioPeriodo } from '../../components/CalendarioPeriodo';
import { Colors } from '../../constants/colors';
import { getRecentChecklists } from '../../services/checklist.service';
import { getVinculosParaAuditoria, pendenciaDoVinculo } from '../../services/vinculo.service';
import { useConectividade } from '../../hooks/useConectividade';
import { useAuthStore } from '../../store/auth.store';
import { Checklist, Vinculo } from '../../types';

type TipoFilter = 'todos' | 'entrada' | 'saida';
type StatusFilter = 'todos' | 'concluido' | 'pendente';
type PresetKey = '30' | '90' | 'mes' | 'tudo';

/**
 * Teto de checklists lidos por intervalo. O intervalo explícito não elimina o teto —
 * "o ano inteiro" numa frota grande ainda estoura. O que ele muda é que bater no teto
 * deixa de ser beco sem saída: dá para estreitar a janela e alcançar o resto.
 */
const PAGE_SIZE = 300;

/** Ao voltar para a tela, recarrega só se já houve busca e os dados envelheceram. */
const STALE_MS = 60_000;

type ChecklistRow = {
  id: string;
  checklistId?: string;
  vinculoId: string;
  tipo: 'entrada' | 'saida';
  status: 'concluido' | 'pendente';
  dateIso?: string;
  condutorIds: string[];
  condutorNome: string;
  veiculoId: string;
  veiculoLabel: string;
  frotaLabel: string;
  placa?: string;
  observacoes?: string;
};

type Opcao = { id: string; label: string; sub?: string };
type Periodo = { inicio: Date | null; fim: Date | null };

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'tudo', label: 'Tudo' },
];

const TIPO_FILTERS: { key: TipoFilter; label: string }[] = [
  { key: 'todos', label: 'Tipos' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'saida', label: 'Saída' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'todos', label: 'Status' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'pendente', label: 'Pendente' },
];

function limpo(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function safeTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Pendência sem data vai para o fim da fila, não para o topo. */
function idadeParaOrdenacao(value?: string): number {
  const time = safeTime(value);
  return time === 0 ? Number.MAX_SAFE_INTEGER : time;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const diaFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(value?: string) {
  const time = safeTime(value);
  if (!time) return 'Sem data';
  return dateFormatter.format(new Date(time));
}

function diffLabel(value?: string) {
  const time = safeTime(value);
  if (!time) return 'sem referência';
  const diffMs = Date.now() - time;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

function aberturaLabel(value?: string): string {
  if (!safeTime(value)) return 'Sem data de abertura';
  return `Aberta ${diffLabel(value)}`;
}

function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** O limite superior precisa fechar o dia — senão um checklist das 14h fica de fora. */
function fimDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function diasAtras(n: number): Date {
  return inicioDoDia(new Date(Date.now() - n * 86_400_000));
}

function rangeDoPreset(key: PresetKey): Periodo {
  if (key === 'tudo') return { inicio: null, fim: null };
  const hoje = inicioDoDia(new Date());
  if (key === 'mes') {
    const h = new Date();
    return { inicio: new Date(h.getFullYear(), h.getMonth(), 1, 0, 0, 0, 0), fim: hoje };
  }
  return { inicio: diasAtras(Number(key)), fim: hoje };
}

function mesmoDia(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return a === b;
  return a.toDateString() === b.toDateString();
}

function rotuloPeriodo({ inicio, fim }: Periodo): string {
  if (!inicio && !fim) return 'Todo o período';
  if (inicio && fim) {
    if (mesmoDia(inicio, fim)) return diaFormatter.format(inicio);
    return `${diaFormatter.format(inicio)} — ${diaFormatter.format(fim)}`;
  }
  if (inicio) return `De ${diaFormatter.format(inicio)}`;
  return `Até ${diaFormatter.format(fim as Date)}`;
}

function periodoParaIso({ inicio, fim }: Periodo) {
  return {
    inicioIso: inicio ? inicioDoDia(inicio).toISOString() : undefined,
    fimIso: fim ? fimDoDia(fim).toISOString() : undefined,
  };
}

/**
 * Nome exibível do veículo — espelha o `nomeVeiculo()` das Cloud Functions.
 *
 * `docToVinculo` faz cast cego do documento, então campos que o TypeScript promete
 * podem chegar `undefined`. A versão anterior montava "undefined Fiorino" e, sem marca
 * nem modelo, produzia "undefined undefined" — string truthy, que nunca caía no fallback.
 */
function vehicleLabel(v: Vinculo): string {
  const nome = [limpo(v.veiculoMarca), limpo(v.veiculoModelo)].filter(Boolean).join(' ');
  if (nome) return nome;
  const placa = limpo(v.veiculoPlaca);
  if (placa) return placa;
  const frota = limpo(v.veiculoFrota);
  if (frota && frota !== '—') return `Frota ${frota}`;
  return 'Veículo sem identificação';
}

/** Vazio quando a frota não veio ou é o traço que o app usa como default. */
function frotaLabel(v: Vinculo): string {
  const frota = limpo(v.veiculoFrota);
  return frota && frota !== '—' ? `Frota ${frota}` : '';
}

function mensagemDeErro(err: unknown, online: boolean): string {
  if (!online) return 'Sem conexão. Reconecte para carregar os checklists.';
  const codigo = limpo((err as { code?: unknown } | null)?.code);
  if (codigo === 'permission-denied') {
    return 'Seu usuário não tem permissão para ver esta auditoria.';
  }
  if (codigo === 'failed-precondition') {
    return 'A consulta precisa de um índice que ainda não existe no Firestore.';
  }
  return 'Não foi possível carregar os checklists. Tente novamente.';
}

function buildRows(checklists: Checklist[], vinculos: Vinculo[]) {
  const porId = new Map(vinculos.map((v) => [v.id, v]));

  const concluidos: ChecklistRow[] = checklists
    .map((c) => {
      const v = porId.get(c.vinculoId);
      return {
        id: `checklist-${c.id}`,
        checklistId: c.id,
        vinculoId: c.vinculoId,
        tipo: c.tipo,
        status: 'concluido' as const,
        dateIso: c.completadoEm,
        // O checklist registra quem o fez; o vínculo pode ter dois condutores.
        condutorIds: [c.condutorId].filter(Boolean),
        condutorNome: v ? limpo(v.condutorNome) || 'Condutor não informado' : 'Condutor não encontrado',
        veiculoId: v?.veiculoId ?? c.veiculoId,
        veiculoLabel: v ? vehicleLabel(v) : 'Veículo não encontrado',
        frotaLabel: v ? frotaLabel(v) : '',
        placa: (v && limpo(v.veiculoPlaca)) || undefined,
        observacoes: c.observacoes,
      };
    })
    .sort((a, b) => safeTime(b.dateIso) - safeTime(a.dateIso));

  // Pendências são derivadas do estado do vínculo, não do campo `pendenciaChecklist`
  // (ver `pendenciaDoVinculo`). Elas ignoram o intervalo de datas de propósito: uma
  // pendência está aberta agora, e a mais antiga é a mais urgente — escondê-la sob
  // "últimos 30 dias" inverteria o sentido da auditoria. Por isso vêm no topo, da
  // mais velha para a mais nova.
  const pendentes: ChecklistRow[] = vinculos
    .map((v) => ({ v, tipo: pendenciaDoVinculo(v) }))
    .filter((x): x is { v: Vinculo; tipo: 'entrada' | 'saida' } => x.tipo !== null)
    .map(({ v, tipo }) => ({
      id: `pendente-${tipo}-${v.id}`,
      vinculoId: v.id,
      tipo,
      status: 'pendente' as const,
      dateIso: tipo === 'saida' ? v.encerradoEm ?? v.criadoEm : v.criadoEm,
      // Qualquer um dos condutores do vínculo deve a pendência.
      condutorIds: (v.condutorIds ?? [v.condutorId]).filter(Boolean),
      condutorNome: limpo(v.condutorNome) || 'Condutor não informado',
      veiculoId: v.veiculoId,
      veiculoLabel: vehicleLabel(v),
      frotaLabel: frotaLabel(v),
      placa: limpo(v.veiculoPlaca) || undefined,
    }))
    .sort((a, b) => idadeParaOrdenacao(a.dateIso) - idadeParaOrdenacao(b.dateIso));

  return { concluidos, pendentes };
}

function MetricTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <Surface style={[styles.metricTile, accent && styles.metricTileAccent]} elevation={0}>
      <View style={[styles.metricIcon, accent && styles.metricIconAccent]}>
        <Ionicons name={icon} size={18} color={accent ? '#FFFFFF' : Colors.primary} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Surface>
  );
}

function PeriodoSheet({
  visible,
  periodo,
  onAplicar,
  onDismiss,
}: {
  visible: boolean;
  periodo: Periodo;
  onAplicar: (p: Periodo) => void;
  onDismiss: () => void;
}) {
  const [rascunho, setRascunho] = useState<Periodo>(periodo);

  // O rascunho existe para que fechar sem aplicar não mexa no período carregado.
  useEffect(() => {
    if (visible) setRascunho(periodo);
  }, [visible, periodo]);

  const presetAtivo = PRESETS.find((p) => {
    const r = rangeDoPreset(p.key);
    return mesmoDia(r.inicio, rascunho.inicio) && mesmoDia(r.fim, rascunho.fim);
  })?.key ?? null;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} contentStyle={styles.sheet}>
      <Text variant="titleMedium" style={styles.sheetTitle}>Período</Text>

      <CalendarioPeriodo
        inicio={rascunho.inicio}
        fim={rascunho.fim}
        onChange={(inicio, fim) => setRascunho({ inicio, fim })}
      />

      <View style={styles.resumo}>
        <Text style={styles.resumoTexto}>{rotuloPeriodo(rascunho)}</Text>
        {rascunho.inicio && !rascunho.fim ? (
          <Text style={styles.resumoHint}>Toque na data final</Text>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {PRESETS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterChip, presetAtivo === item.key && styles.filterChipActive]}
            onPress={() => setRascunho(rangeDoPreset(item.key))}
          >
            <Text style={[styles.filterText, presetAtivo === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sheetAcoes}>
        <TouchableOpacity
          style={styles.acaoSecundaria}
          onPress={() => setRascunho({ inicio: null, fim: null })}
        >
          <Text style={styles.acaoSecundariaTexto}>Limpar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acaoPrimaria}
          onPress={() => { onAplicar(rascunho); onDismiss(); }}
        >
          <Text style={styles.acaoPrimariaTexto}>Aplicar</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

function SeletorSheet({
  visible,
  titulo,
  placeholder,
  opcoes,
  selecionado,
  onSelecionar,
  onDismiss,
}: {
  visible: boolean;
  titulo: string;
  placeholder: string;
  opcoes: Opcao[];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  onDismiss: () => void;
}) {
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (visible) setBusca('');
  }, [visible]);

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? opcoes.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(termo))
    : opcoes;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} keyboardAvoiding contentStyle={styles.sheet}>
      <Text variant="titleMedium" style={styles.sheetTitle}>{titulo}</Text>

      <View style={styles.buscaWrapper}>
        <Ionicons name="search-outline" size={16} color={Colors.textHint} />
        <RNTextInput
          value={busca}
          onChangeText={setBusca}
          placeholder={placeholder}
          placeholderTextColor={Colors.textHint}
          style={styles.buscaInput}
        />
      </View>

      <TouchableOpacity style={styles.opcaoRow} onPress={() => { onSelecionar(null); onDismiss(); }}>
        <Text style={[styles.opcaoLabel, !selecionado && styles.opcaoLabelAtiva]}>Todos</Text>
        {!selecionado ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
      </TouchableOpacity>

      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        style={{ maxHeight: 360 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separador} />}
        ListEmptyComponent={<Text style={styles.sheetVazio}>Nada encontrado</Text>}
        renderItem={({ item }) => {
          const ativo = item.id === selecionado;
          return (
            <TouchableOpacity
              style={styles.opcaoRow}
              onPress={() => { onSelecionar(item.id); onDismiss(); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.opcaoLabel, ativo && styles.opcaoLabelAtiva]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.sub ? <Text style={styles.opcaoSub} numberOfLines={1}>{item.sub}</Text> : null}
              </View>
              {ativo ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheet>
  );
}

function ChecklistsContent() {
  const router = useRouter();
  const online = useConectividade();
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [truncado, setTruncado] = useState(false);

  // Nada é lido até o usuário tocar em Buscar.
  const [buscou, setBuscou] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>(() => rangeDoPreset('30'));
  const [periodoCarregado, setPeriodoCarregado] = useState<Periodo | null>(null);
  const [periodoAberto, setPeriodoAberto] = useState(false);

  // Recorte do conjunto já carregado — não dispara consulta.
  const [condutorId, setCondutorId] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [seletor, setSeletor] = useState<'condutor' | 'veiculo' | null>(null);
  const [tipo, setTipo] = useState<TipoFilter>('todos');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [busca, setBusca] = useState('');

  const pedidoRef = useRef(0);
  const carregadoEmRef = useRef(0);
  const buscouRef = useRef(false);
  buscouRef.current = buscou;

  const carregar = useCallback(async (modo: 'inicial' | 'refresh', alvo: Periodo) => {
    const pedido = pedidoRef.current + 1;
    pedidoRef.current = pedido;

    if (modo === 'refresh') setRefreshing(true);
    else setLoading(true);
    setErro(null);

    try {
      const [doPeriodo, todosVinculos] = await Promise.all([
        getRecentChecklists({ ...periodoParaIso(alvo), pageSize: PAGE_SIZE }),
        getVinculosParaAuditoria(),
      ]);
      if (pedido !== pedidoRef.current) return;

      setChecklists(doPeriodo);
      setVinculos(todosVinculos);
      setTruncado(doPeriodo.length >= PAGE_SIZE);
      setPeriodoCarregado(alvo);
      carregadoEmRef.current = Date.now();
    } catch (err) {
      if (pedido !== pedidoRef.current) return;
      console.warn('[checklists] falha ao carregar auditoria:', err);
      setErro(mensagemDeErro(err, onlineRef.current));
    } finally {
      if (pedido === pedidoRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const buscar = useCallback(() => {
    setBuscou(true);
    carregar('inicial', periodo);
  }, [carregar, periodo]);

  // Guardados em ref de propósito: o callback de foco não pode mudar de identidade a
  // cada ajuste de período, senão o foco dispararia cargas que o usuário não pediu.
  // E ele reatualiza o período **carregado**, não o pendente — mudar as datas sem tocar
  // em Buscar não deve virar uma busca só porque a tela recebeu foco de novo.
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;
  const periodoCarregadoRef = useRef(periodoCarregado);
  periodoCarregadoRef.current = periodoCarregado;

  useFocusEffect(
    useCallback(() => {
      const alvo = periodoCarregadoRef.current;
      if (buscouRef.current && alvo && carregadoEmRef.current
        && Date.now() - carregadoEmRef.current > STALE_MS) {
        carregarRef.current('refresh', alvo);
      }
    }, []),
  );

  const { concluidos, pendentes } = useMemo(
    () => buildRows(checklists, vinculos),
    [checklists, vinculos],
  );

  const condutoresDisponiveis = useMemo<Opcao[]>(() => {
    const mapa = new Map<string, string>();
    vinculos.forEach((v) => {
      if (v.condutorId) mapa.set(v.condutorId, limpo(v.condutorNome) || 'Condutor sem nome');
      if (v.condutorId2) mapa.set(v.condutorId2, limpo(v.condutorNome2) || 'Condutor sem nome');
    });
    return [...mapa.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [vinculos]);

  const veiculosDisponiveis = useMemo<Opcao[]>(() => {
    const mapa = new Map<string, Opcao>();
    vinculos.forEach((v) => {
      if (!v.veiculoId || mapa.has(v.veiculoId)) return;
      const sub = [frotaLabel(v), limpo(v.veiculoPlaca)].filter(Boolean).join(' · ');
      mapa.set(v.veiculoId, { id: v.veiculoId, label: vehicleLabel(v), sub: sub || undefined });
    });
    return [...mapa.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [vinculos]);

  const condutorLabel = condutoresDisponiveis.find((o) => o.id === condutorId)?.label ?? null;
  const veiculoLabelSel = veiculosDisponiveis.find((o) => o.id === veiculoId)?.label ?? null;

  // Escopo = período + condutor + veículo. Os chips de tipo/status e a busca por texto
  // são refinamento da visão, e por isso não entram aqui: filtrar por "Concluído" não
  // pode zerar os tiles de pendência.
  const escopo = useMemo(() => {
    const casa = (row: ChecklistRow) =>
      (!condutorId || row.condutorIds.includes(condutorId))
      && (!veiculoId || row.veiculoId === veiculoId);
    return {
      concluidos: concluidos.filter(casa),
      pendentes: pendentes.filter(casa),
    };
  }, [concluidos, pendentes, condutorId, veiculoId]);

  const metrics = useMemo(
    () => ({
      realizados: escopo.concluidos.length,
      entradaPendente: escopo.pendentes.filter((r) => r.tipo === 'entrada').length,
      saidaPendente: escopo.pendentes.filter((r) => r.tipo === 'saida').length,
      comObservacao: escopo.concluidos.filter((r) => r.observacoes?.trim()).length,
    }),
    [escopo],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const casa = (row: ChecklistRow) => {
      if (tipo !== 'todos' && row.tipo !== tipo) return false;
      if (!termo) return true;
      return [row.condutorNome, row.veiculoLabel, row.frotaLabel, row.placa, row.observacoes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo);
    };

    return [
      ...(status === 'concluido' ? [] : escopo.pendentes.filter(casa)),
      ...(status === 'pendente' ? [] : escopo.concluidos.filter(casa)),
    ];
  }, [busca, escopo, status, tipo]);

  const periodoDesatualizado = !!periodoCarregado
    && !(mesmoDia(periodoCarregado.inicio, periodo.inicio)
      && mesmoDia(periodoCarregado.fim, periodo.fim));

  const ocupado = loading || refreshing;

  const renderRow = useCallback(({ item: row }: { item: ChecklistRow }) => (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        if (row.checklistId) {
          router.push(`/checklists/${row.checklistId}` as any);
        } else {
          router.push(`/veiculo/${row.veiculoId}` as any);
        }
      }}
    >
      <Surface style={styles.rowCard} elevation={1}>
        <View style={styles.rowTop}>
          <View style={[styles.typeBadge, row.tipo === 'saida' && styles.typeBadgeExit]}>
            <Ionicons
              name={row.tipo === 'entrada' ? 'log-in-outline' : 'log-out-outline'}
              size={14}
              color={row.tipo === 'entrada' ? Colors.primary : '#2563EB'}
            />
            <Text style={[styles.typeText, row.tipo === 'saida' && styles.typeTextExit]}>
              {row.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            </Text>
          </View>
          <View style={[styles.statusBadge, row.status === 'pendente' && styles.statusBadgePending]}>
            <Text style={[styles.statusText, row.status === 'pendente' && styles.statusTextPending]}>
              {row.status === 'concluido' ? 'Concluído' : 'Pendente'}
            </Text>
          </View>
        </View>

        <Text variant="bodyMedium" style={styles.vehicleName} numberOfLines={1}>
          {row.veiculoLabel}
        </Text>
        <Text variant="bodySmall" style={styles.metaText} numberOfLines={1}>
          {[row.frotaLabel, row.placa, row.condutorNome].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.rowBottom}>
          <Text variant="bodySmall" style={styles.dateText}>
            {row.status === 'pendente' ? aberturaLabel(row.dateIso) : formatDate(row.dateIso)}
          </Text>
          {row.observacoes ? (
            <View style={styles.obsBadge}>
              <Ionicons name="chatbubble-ellipses-outline" size={13} color="#D97706" />
              <Text style={styles.obsText}>Observação</Text>
            </View>
          ) : null}
        </View>
      </Surface>
    </TouchableOpacity>
  ), [router]);

  const listHeader = !buscou || erro || loading ? null : (
    <>
      <View style={styles.metricsGrid}>
        <MetricTile label="Realizados" value={metrics.realizados} icon="checkmark-circle-outline" accent />
        <MetricTile label="Entrada pendente" value={metrics.entradaPendente} icon="log-in-outline" />
        <MetricTile label="Saída pendente" value={metrics.saidaPendente} icon="log-out-outline" />
        <MetricTile label="Com observação" value={metrics.comObservacao} icon="alert-circle-outline" />
      </View>

      {truncado ? (
        <View style={styles.aviso}>
          <Ionicons name="information-circle-outline" size={16} color="#D97706" />
          <Text style={styles.avisoTexto}>
            O período tem mais de {PAGE_SIZE} checklists e a lista foi cortada nos mais
            recentes. Estreite as datas para alcançar o resto.
          </Text>
        </View>
      ) : null}

      {(periodo.inicio || periodo.fim) && escopo.pendentes.length > 0 ? (
        <View style={styles.aviso}>
          <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
          <Text style={styles.avisoTexto}>
            {escopo.pendentes.length === 1
              ? 'A pendência aparece fora do período — ela está aberta agora.'
              : `As ${escopo.pendentes.length} pendências aparecem fora do período — estão abertas agora.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.filtroLinha}>
        <TouchableOpacity style={styles.filtroBotao} onPress={() => setSeletor('condutor')}>
          <Ionicons name="person-outline" size={16} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filtroRotulo}>Condutor</Text>
            <Text style={styles.filtroValor} numberOfLines={1}>{condutorLabel ?? 'Todos'}</Text>
          </View>
          {condutorId ? (
            <TouchableOpacity onPress={() => setCondutorId(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={16} color={Colors.textHint} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.filtroBotao} onPress={() => setSeletor('veiculo')}>
          <Ionicons name="car-outline" size={16} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filtroRotulo}>Veículo</Text>
            <Text style={styles.filtroValor} numberOfLines={1}>{veiculoLabelSel ?? 'Todos'}</Text>
          </View>
          {veiculoId ? (
            <TouchableOpacity onPress={() => setVeiculoId(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={16} color={Colors.textHint} />
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        mode="outlined"
        label="Buscar por observação, frota ou placa"
        value={busca}
        onChangeText={setBusca}
        left={<TextInput.Icon icon="magnify" />}
        right={busca ? <TextInput.Icon icon="close" onPress={() => setBusca('')} /> : undefined}
        style={styles.search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TIPO_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterChip, tipo === item.key && styles.filterChipActive]}
            onPress={() => setTipo(item.key)}
          >
            <Text style={[styles.filterText, tipo === item.key && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
        {STATUS_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterChip, status === item.key && styles.filterChipActive]}
            onPress={() => setStatus(item.key)}
          >
            <Text style={[styles.filterText, status === item.key && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text variant="titleSmall" style={styles.sectionTitle}>Registros</Text>
        <Text variant="bodySmall" style={styles.countText}>{visiveis.length} no filtro</Text>
      </View>
    </>
  );

  const listEmpty = erro ? (
    <Surface style={styles.emptyCard} elevation={0}>
      <Ionicons name="alert-circle-outline" size={42} color="#DC2626" />
      <Text style={[styles.emptyText, { color: '#DC2626' }]}>{erro}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={buscar}>
        <Text style={styles.retryText}>Tentar novamente</Text>
      </TouchableOpacity>
    </Surface>
  ) : loading ? (
    <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
  ) : !buscou ? (
    <Surface style={styles.emptyCard} elevation={0}>
      <Ionicons name="calendar-outline" size={42} color={Colors.textHint} />
      <Text style={styles.emptyText}>
        Escolha o período e toque em Buscar para carregar os checklists
      </Text>
    </Surface>
  ) : (
    <Surface style={styles.emptyCard} elevation={0}>
      <Ionicons name="document-text-outline" size={42} color={Colors.textHint} />
      <Text style={styles.emptyText}>Nenhum checklist encontrado neste filtro</Text>
    </Surface>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text variant="titleLarge" style={styles.title}>Checklists</Text>
          <Text variant="bodySmall" style={styles.subtitle}>Entradas, saídas e pendências</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.barra}>
        <TouchableOpacity
          style={styles.periodoBotao}
          onPress={() => setPeriodoAberto(true)}
          disabled={ocupado}
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filtroRotulo}>Período</Text>
            <Text style={styles.filtroValor} numberOfLines={1}>{rotuloPeriodo(periodo)}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={Colors.textHint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buscarBotao, ocupado && styles.buscarBotaoOff]}
          onPress={buscar}
          disabled={ocupado}
        >
          {ocupado ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.buscarTexto}>Buscar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {periodoDesatualizado && !ocupado ? (
        <Text style={styles.desatualizado}>
          Período alterado — toque em Buscar para atualizar a lista.
        </Text>
      ) : null}

      <FlatList
        data={!buscou || loading || erro ? [] : visiveis}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />

      <PeriodoSheet
        visible={periodoAberto}
        periodo={periodo}
        onAplicar={setPeriodo}
        onDismiss={() => setPeriodoAberto(false)}
      />

      <SeletorSheet
        visible={seletor === 'condutor'}
        titulo="Filtrar por condutor"
        placeholder="Buscar condutor…"
        opcoes={condutoresDisponiveis}
        selecionado={condutorId}
        onSelecionar={setCondutorId}
        onDismiss={() => setSeletor(null)}
      />

      <SeletorSheet
        visible={seletor === 'veiculo'}
        titulo="Filtrar por veículo"
        placeholder="Buscar por modelo, frota ou placa…"
        opcoes={veiculosDisponiveis}
        selecionado={veiculoId}
        onSelecionar={setVeiculoId}
        onDismiss={() => setSeletor(null)}
      />
    </SafeAreaView>
  );
}

export default function ChecklistsScreen() {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.perfil !== 'gestor') return <Redirect href="/(tabs)" />;
  return <ChecklistsContent />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: Colors.textPrimary, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, marginTop: 2 },
  barra: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 10 },
  periodoBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buscarBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 104,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
  },
  buscarBotaoOff: { opacity: 0.6 },
  buscarTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  desatualizado: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    fontSize: 12,
    color: '#92400E',
  },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricTile: {
    width: '48%',
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
  },
  metricTileAccent: { borderColor: '#BCCFED', backgroundColor: '#EDF2FB' },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricIconAccent: { backgroundColor: Colors.primary },
  metricValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  avisoTexto: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17 },
  filtroLinha: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  filtroBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filtroRotulo: { fontSize: 11, color: Colors.textHint },
  filtroValor: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  search: { marginBottom: 12, backgroundColor: Colors.card },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: Colors.textPrimary, fontWeight: '700' },
  countText: { color: Colors.textHint },
  sheet: { backgroundColor: Colors.background },
  sheetTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  sheetVazio: { color: Colors.textHint, textAlign: 'center', padding: 20 },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resumoTexto: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  resumoHint: { fontSize: 12, color: Colors.textHint },
  sheetAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  acaoSecundaria: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  acaoSecundariaTexto: { color: Colors.textSecondary, fontWeight: '700' },
  acaoPrimaria: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  acaoPrimariaTexto: { color: '#FFFFFF', fontWeight: '700' },
  buscaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
  buscaInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  opcaoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  opcaoLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  opcaoLabelAtiva: { color: Colors.primary, fontWeight: '700' },
  opcaoSub: { fontSize: 12, color: Colors.textHint, marginTop: 2 },
  separador: { height: 1, backgroundColor: Colors.border },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: Colors.textHint, textAlign: 'center' },
  retryButton: {
    borderRadius: 8,
    backgroundColor: '#EDF2FB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryText: { color: Colors.primary, fontWeight: '700' },
  rowCard: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    backgroundColor: '#EDF2FB',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  typeBadgeExit: { backgroundColor: '#EFF6FF' },
  typeText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  typeTextExit: { color: '#2563EB' },
  statusBadge: {
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgePending: { backgroundColor: '#FFFBEB' },
  statusText: { color: '#15803D', fontSize: 12, fontWeight: '700' },
  statusTextPending: { color: '#D97706' },
  vehicleName: { color: Colors.textPrimary, fontWeight: '700' },
  metaText: { color: Colors.textSecondary, marginTop: 2 },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  dateText: { color: Colors.textHint },
  obsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  obsText: { color: '#D97706', fontSize: 12, fontWeight: '700' },
});
