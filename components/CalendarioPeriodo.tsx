import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Colors } from '../constants/colors';

type Props = {
  inicio: Date | null;
  fim: Date | null;
  onChange: (inicio: Date | null, fim: Date | null) => void;
  /** Nenhum dia posterior pode ser escolhido. Default: agora. */
  maxDate?: Date;
};

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Calendário de mês único com seleção de intervalo.
 *
 * Feito à mão em cima do `date-fns` (já é dependência) em vez de puxar uma lib de
 * calendário: o `@react-native-community/datetimepicker` do projeto só escolhe uma data
 * por vez, e as libs de intervalo trariam tema próprio para conciliar com o design system.
 */
export function CalendarioPeriodo({ inicio, fim, onChange, maxDate }: Props) {
  const limite = maxDate ?? new Date();
  const [mes, setMes] = useState<Date>(() => startOfMonth(inicio ?? new Date()));

  const dias = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }),
  }), [mes]);

  const podeAvancar = isBefore(startOfMonth(mes), startOfMonth(limite));

  function selecionar(dia: Date) {
    // Sem início, ou intervalo já fechado → o toque começa um intervalo novo.
    // Toque antes do início → vira o novo início, em vez de intervalo invertido.
    if (!inicio || fim || isBefore(dia, inicio)) {
      onChange(dia, null);
      return;
    }
    onChange(inicio, dia);
  }

  return (
    <View>
      <View style={styles.navegacao}>
        <TouchableOpacity onPress={() => setMes(subMonths(mes, 1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.mesLabel}>{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</Text>
        <TouchableOpacity
          onPress={() => setMes(addMonths(mes, 1))}
          hitSlop={10}
          disabled={!podeAvancar}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={podeAvancar ? Colors.primary : Colors.border}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.linha}>
        {DIAS_SEMANA.map((d, i) => (
          <View key={`${d}-${i}`} style={styles.celula}>
            <Text style={styles.semanaLabel}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grade}>
        {dias.map((dia) => {
          const foraDoMes = !isSameMonth(dia, mes);
          const desabilitado = foraDoMes || isAfter(dia, limite);
          const ehInicio = !!inicio && isSameDay(dia, inicio);
          const ehFim = !!fim && isSameDay(dia, fim);
          const ponta = ehInicio || ehFim;
          const dentro = !!inicio && !!fim && isAfter(dia, inicio) && isBefore(dia, fim);

          return (
            <TouchableOpacity
              key={dia.toISOString()}
              style={styles.celula}
              disabled={desabilitado}
              onPress={() => selecionar(dia)}
              activeOpacity={0.7}
            >
              <View style={[styles.dia, dentro && styles.diaDentro, ponta && styles.diaPonta]}>
                <Text
                  style={[
                    styles.diaTexto,
                    desabilitado && styles.diaTextoDesabilitado,
                    ponta && styles.diaTextoPonta,
                  ]}
                >
                  {format(dia, 'd')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navegacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  mesLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  linha: { flexDirection: 'row' },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  celula: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  semanaLabel: { fontSize: 11, fontWeight: '700', color: Colors.textHint, paddingBottom: 6 },
  dia: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaDentro: { backgroundColor: '#EDF2FB', borderRadius: 8 },
  diaPonta: { backgroundColor: Colors.primary },
  diaTexto: { fontSize: 14, color: Colors.textPrimary },
  diaTextoDesabilitado: { color: Colors.border },
  diaTextoPonta: { color: '#FFFFFF', fontWeight: '700' },
});
