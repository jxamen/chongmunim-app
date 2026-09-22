/**
 * 탭 위에 겹쳐 뜨는 화면(쪽) — store 의 `pages` 맨 위 한 장을 그린다. 어느 화면이 어느 쪽인지 여기 한 곳에 모은다.
 */
import React from 'react';
import type { Page } from '../store';
import { RecordScreen } from './RecordScreen';
import { RequestsScreen } from './RequestsScreen';
import { EventNewScreen, EventScreen } from './EventScreen';
import { ComposeScreen, NoticeScreen } from './NoticeScreens';
import { TidyScreen } from './TidyScreen';
import { GroupsScreen } from './GroupsScreen';
import {
  BudgetLineScreen, CategoriesScreen, EntryScreen, GroupEditScreen, MembersScreen, ProfileScreen, ReceiptScreen, TransferScreen,
} from './ManageScreens';

export function PageView({ page }: { page: Page }) {
  switch (page.kind) {
    case 'record': return <RecordScreen start={page.start} />;
    case 'requests': return <RequestsScreen />;
    case 'event': return <EventScreen id={page.id} />;
    case 'eventNew': return <EventNewScreen />;
    case 'notice': return <NoticeScreen id={page.id} />;
    case 'compose': return <ComposeScreen draftId={page.draftId} audience={page.audience} />;
    case 'tidy': return <TidyScreen />;
    case 'entry': return <EntryScreen entry={page.entry} />;
    case 'receipt': return <ReceiptScreen id={page.id} />;
    case 'members': return <MembersScreen />;
    case 'categories': return <CategoriesScreen />;
    case 'profile': return <ProfileScreen />;
    case 'groupEdit': return <GroupEditScreen />;
    case 'transfer': return <TransferScreen />;
    case 'groups': return <GroupsScreen asPage />;
    case 'budgetLine': return <BudgetLineScreen line={page.line} year={page.year} />;
    default: return null;
  }
}
