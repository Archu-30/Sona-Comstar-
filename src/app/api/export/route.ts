import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  getClosingInventoryFlat,
  getInventoryAgeing,
  getImportGIT,
} from '@/lib/excel-processor';
import type {
  InventoryItem,
  InventoryAgeingItem,
  ImportGITItem,
} from '@/types';

type DataRow = InventoryItem | InventoryAgeingItem | ImportGITItem;

interface ExportRequestBody {
  module: 'inventory' | 'ageing' | 'git';
  format: 'xlsx' | 'csv';
  filters?: Record<string, string>;
  search?: string;
}

function applyFilters(
  data: DataRow[],
  filters: Record<string, string>,
  search: string
): DataRow[] {
  let filtered = data;

  if (search) {
    const lowerSearch = search.toLowerCase();
    filtered = filtered.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(lowerSearch)
      )
    );
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    filtered = filtered.filter((row) => {
      const record = row as unknown as Record<string, unknown>;
      return String(record[key] ?? '')
        .toLowerCase()
        .includes(value.toLowerCase());
    });
  }

  return filtered;
}

const INVENTORY_HEADERS: Record<string, string> = {
  glAccount: 'G/L Account',
  valuationArea: 'Valuation Area',
  material: 'Material',
  description: 'Description',
  totalStock: 'Total Stock',
  unit: 'Unit',
  totalValue: 'Total Value',
  currency: 'Currency',
  type: 'Type',
};

const AGEING_HEADERS: Record<string, string> = {
  material: 'Material',
  materialDescription: 'Material Description',
  plant: 'Plant',
  storageLocation: 'Storage Location',
  batch: 'Batch',
  baseUnit: 'Base Unit',
  unrestricted: 'Unrestricted',
  currency: 'Currency',
  valueUnrestricted: 'Value Unrestricted',
  transitTransfer: 'Transit/Transfer',
  qualityInspection: 'Quality Inspection',
  blocked: 'Blocked',
  returns: 'Returns',
};

const GIT_HEADERS: Record<string, string> = {
  invoiceNumber: 'Invoice Number',
  invoiceDate: 'Invoice Date',
  asnCreatedOn: 'ASN Created On',
  material: 'Material',
  materialDescription: 'Material Description',
  vendorCode: 'Vendor Code',
  currency: 'Currency',
  qty: 'Qty',
  rate: 'Rate',
  value: 'Value',
  exRate: 'EX Rate',
  cyValue: 'CY Value',
  product: 'Product',
};

function getHeaders(module: string): Record<string, string> {
  switch (module) {
    case 'inventory':
      return INVENTORY_HEADERS;
    case 'ageing':
      return AGEING_HEADERS;
    case 'git':
      return GIT_HEADERS;
    default:
      return {};
  }
}

function formatForExport(
  data: DataRow[],
  headers: Record<string, string>
): Record<string, unknown>[] {
  return data.map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const formatted: Record<string, unknown> = {};
    for (const [key, label] of Object.entries(headers)) {
      const val = record[key];
      // Convert timestamps back to readable dates for export
      if (
        (key === 'invoiceDate' ||
          key === 'asnCreatedOn' ||
          key === 'grIssueDate' ||
          key === 'agingDateOfReceipt' ||
          key === 'enteredOn' ||
          key === 'agingLastTransfer' ||
          key === 'manufactureDate' ||
          key === 'manufactureDateAging') &&
        typeof val === 'number' &&
        val > 0
      ) {
        formatted[label] = new Date(val).toLocaleDateString('en-IN');
      } else {
        formatted[label] = val ?? '';
      }
    }
    return formatted;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    const { module, format, filters = {}, search = '' } = body;

    if (!module || !format) {
      return NextResponse.json(
        { error: 'module and format are required' },
        { status: 400 }
      );
    }

    if (format !== 'xlsx' && format !== 'csv') {
      return NextResponse.json(
        { error: 'format must be xlsx or csv' },
        { status: 400 }
      );
    }

    let rawData: DataRow[];
    switch (module) {
      case 'inventory':
        rawData = getClosingInventoryFlat();
        break;
      case 'ageing':
        rawData = getInventoryAgeing();
        break;
      case 'git':
        rawData = getImportGIT();
        break;
      default:
        return NextResponse.json(
          { error: `Unknown module: ${module}` },
          { status: 400 }
        );
    }

    const filtered = applyFilters(rawData, filters, search);
    const headers = getHeaders(module);
    const exportData = formatForExport(filtered, headers);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, module);

    let buffer: Buffer;
    let contentType: string;
    let extension: string;

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      buffer = Buffer.from(csvContent, 'utf-8');
      contentType = 'text/csv; charset=utf-8';
      extension = 'csv';
    } else {
      const xlsxBuffer = XLSX.write(wb, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer;
      buffer = xlsxBuffer;
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    }

    const filename = `${module}-export-${Date.now()}.${extension}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
