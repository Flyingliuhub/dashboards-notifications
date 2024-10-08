/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EuiBasicTable,
  EuiSmallButton,
  EuiEmptyPrompt,
  EuiHorizontalRule,
  EuiTableFieldDataColumnType,
  EuiTableSortingType,
  SortDirection,
} from '@elastic/eui';
import { Criteria } from '@elastic/eui/src/components/basic_table/basic_table';
import { Pagination } from '@elastic/eui/src/components/basic_table/pagination_bar';
import _ from 'lodash';
import React, { Component } from 'react';
import { CoreStart } from '../../../../../../../src/core/public';
import { SenderItemType, TableState } from '../../../../../models/interfaces';
import {
  ContentPanel,
  ContentPanelActions,
} from '../../../../components/ContentPanel';
import { ModalConsumer } from '../../../../components/Modal';
import { NotificationService, ServicesContext } from '../../../../services';
import { ENCRYPTION_TYPE, ROUTES } from '../../../../utils/constants';
import { getErrorMessage } from '../../../../utils/helpers';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '../../../Notifications/utils/constants';
import { DeleteSenderModal } from '../modals/DeleteSenderModal';
import {
  SendersTableControls,
  SendersTableControlsFilterType,
} from './SendersTableControls';
import {
  isDataSourceError,
  isDataSourceChanged,
} from '../../../../components/MDSEnabledComponent/MDSEnabledComponent';

interface SendersTableProps {
  coreContext: CoreStart;
  notificationService: NotificationService;
}

interface SendersTableState extends TableState<SenderItemType> {
  filters: SendersTableControlsFilterType;
}

export class SendersTable extends Component<
  SendersTableProps,
  SendersTableState
> {
  static contextType = ServicesContext;
  columns: EuiTableFieldDataColumnType<SenderItemType>[];

  constructor(props: SendersTableProps) {
    super(props);

    this.state = {
      total: 0,
      from: 0,
      size: 5,
      search: '',
      sortField: 'name',
      sortDirection: SortDirection.ASC,
      items: [],
      selectedItems: [],
      loading: true,
      filters: {
        encryptionMethod: [],
      },
    };

    this.columns = [
      {
        field: 'name',
        name: 'Name',
        sortable: true,
        truncateText: true,
        width: '200px',
      },
      {
        field: 'smtp_account.from_address',
        name: 'Outbound email address',
        sortable: true,
        truncateText: true,
        width: '200px',
      },
      {
        field: 'smtp_account.host',
        name: 'Host',
        sortable: true,
        truncateText: true,
        width: '200px',
      },
      {
        field: 'smtp_account.port',
        name: 'Port',
        sortable: false,
        truncateText: true,
        width: '200px',
      },
      {
        field: 'smtp_account.method',
        name: 'Encryption method',
        sortable: true,
        truncateText: true,
        width: '200px',
        render: (method: string) => _.get(ENCRYPTION_TYPE, method, '-'),
      },
    ];
    this.refresh = this.refresh.bind(this);
  }

  async componentDidMount() {
    await this.refresh();
  }

  async componentDidUpdate(
    prevProps: SendersTableProps,
    prevState: SendersTableState
  ) {
    const prevQuery = SendersTable.getQueryObjectFromState(prevState);
    const currQuery = SendersTable.getQueryObjectFromState(this.state);
    if (!_.isEqual(prevQuery, currQuery)) {
      await this.refresh();
    }
    if (isDataSourceChanged(this.props, prevProps)) {
      await this.refresh();
    }
  }

  static getQueryObjectFromState(state: SendersTableState) {
    const queryObject: any = {
      from_index: state.from,
      max_items: state.size,
      query: state.search,
      config_type: 'smtp_account',
      sort_field: state.sortField,
      sort_order: state.sortDirection,
    };
    if (state.filters.encryptionMethod.length > 0) {
      queryObject['smtp_account.method'] = state.filters.encryptionMethod;
    }
    return queryObject;
  }

  async refresh() {
    this.setState({ loading: true });
    try {
      const queryObject = SendersTable.getQueryObjectFromState(this.state);
      const senders = await this.context.notificationService.getSenders(
        queryObject
      );
      this.setState({ items: senders.items, total: senders.total });
    } catch (error) {
      if (isDataSourceError(error)) {
        this.setState({ items: [], total: 0 });
      }
      this.props.coreContext.notifications.toasts.addDanger(
        getErrorMessage(error, 'There was a problem loading SMTP senders.')
      );
    }
    this.setState({ loading: false });
  }

  onTableChange = ({
    page: tablePage,
    sort,
  }: Criteria<SenderItemType>): void => {
    const { index: page, size } = tablePage!;
    const { field: sortField, direction: sortDirection } = sort!;
    this.setState({ from: page * size, size, sortField, sortDirection });
  };

  onSelectionChange = (selectedItems: SenderItemType[]): void => {
    this.setState({ selectedItems });
  };

  onSearchChange = (search: string): void => {
    this.setState({ from: 0, search });
  };

  render() {
    const page = Math.floor(this.state.from / this.state.size);

    const pagination: Pagination = {
      pageIndex: page,
      pageSize: this.state.size,
      pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      totalItemCount: this.state.total,
    };

    const sorting: EuiTableSortingType<SenderItemType> = {
      sort: {
        direction: this.state.sortDirection,
        field: this.state.sortField,
      },
    };

    const selection = {
      selectable: () => true,
      onSelectionChange: this.onSelectionChange,
    };

    return (
      <ContentPanel
        actions={
          <ContentPanelActions
            actions={[
              {
                component: (
                  <ModalConsumer>
                    {({ onShow }) => (
                      <EuiSmallButton
                        data-test-subj="senders-table-delete-button"
                        disabled={this.state.selectedItems.length === 0}
                        onClick={() =>
                          onShow(DeleteSenderModal, {
                            senders: this.state.selectedItems,
                            refresh: this.refresh,
                          })
                        }
                      >
                        Delete
                      </EuiSmallButton>
                    )}
                  </ModalConsumer>
                ),
              },
              {
                component: (
                  <EuiSmallButton
                    data-test-subj="senders-table-edit-button"
                    disabled={this.state.selectedItems.length !== 1}
                    onClick={() =>
                      location.assign(
                        `#${ROUTES.EDIT_SENDER}/${this.state.selectedItems[0]?.config_id}`
                      )
                    }
                  >
                    Edit
                  </EuiSmallButton>
                ),
              },
              {
                component: (
                  <EuiSmallButton fill href={`#${ROUTES.CREATE_SENDER}`}>
                    Create SMTP sender
                  </EuiSmallButton>
                ),
              },
            ]}
          />
        }
        bodyStyles={{ padding: 'initial' }}
        title="SMTP senders"
        titleSize="m"
        total={this.state.total}
      >
        <SendersTableControls
          onSearchChange={this.onSearchChange}
          filters={this.state.filters}
          onFiltersChange={(filters) => this.setState({ filters })}
        />
        <EuiHorizontalRule margin="s" />

        <EuiBasicTable
          columns={this.columns}
          items={this.state.items}
          itemId="config_id"
          isSelectable={true}
          selection={selection}
          noItemsMessage={
            <EuiEmptyPrompt
              title={<h2>No SMTP senders to display</h2>}
              body="Set up an outbound email server by creating a sender. You will select a sender when configuring email channels."
              actions={
                <EuiSmallButton href={`#${ROUTES.CREATE_SENDER}`}>
                  Create SMTP sender
                </EuiSmallButton>
              }
            />
          }
          onChange={this.onTableChange}
          pagination={pagination}
          sorting={sorting}
          loading={this.state.loading}
        />
      </ContentPanel>
    );
  }
}
